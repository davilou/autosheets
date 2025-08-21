import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { decrypt } from '@/lib/security/encryption';
import { getUserFromToken } from '@/lib/auth/utils';
import bigInt from 'big-integer';

const prisma = new PrismaClient();

/**
 * POST /api/telegram/start-bot-chat
 * Inicia uma conversa com o bot usando MTProto
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Iniciando chat com bot...');
    
    const user = getUserFromToken(request);
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('✅ Usuário autenticado:', user.userId);

    const body = await request.json();
    const { credentialId } = body;

    if (!credentialId) {
      return NextResponse.json(
        { success: false, message: 'credentialId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar credencial do usuário
    console.log('🔑 Buscando credencial...');
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.userId
      },
      include: {
        sessions: {
          where: { isActive: true },
          orderBy: { lastUsed: 'desc' },
          take: 1
        }
      }
    });

    if (!credential || !credential.sessions.length) {
      console.log('❌ Credencial ou sessão não encontrada');
      return NextResponse.json(
        { success: false, message: 'Credencial ou sessão não encontrada' },
        { status: 404 }
      );
    }

    if (credential.status !== 'CONNECTED') {
      return NextResponse.json(
        { success: false, message: 'Credencial não está conectada' },
        { status: 400 }
      );
    }

    console.log('✅ Credencial e sessão encontradas:', credential.id);

    const sessionData = credential.sessions[0].sessionData;
    
    // Descriptografar dados da sessão
    const decryptedSessionData = decrypt(sessionData, user.userId);
    
    // Extrair sessionString do JSON
    let sessionString = '';
    try {
      const sessionDataObj = JSON.parse(decryptedSessionData);
      sessionString = sessionDataObj.sessionString || '';
    } catch (error) {
      console.error('❌ Erro ao fazer parse da sessão:', error);
      return NextResponse.json(
        { success: false, message: 'Dados da sessão inválidos' },
        { status: 400 }
      );
    }
    
    // Descriptografar credenciais
    const decryptedApiId = decrypt(credential.apiId, user.userId);
    const decryptedApiHash = decrypt(credential.apiHash, user.userId);
    
    // Obter bot username do ambiente (ou fallback explícito informado)
    const envBotUsername = (process.env.TELEGRAM_BOT_USERNAME || 'apostasmonitorbot').replace('@', '');

    // Criar cliente Telegram
    const client = new TelegramClient(
      new StringSession(sessionString),
      parseInt(decryptedApiId),
      decryptedApiHash,
      {
        connectionRetries: 5,
        requestRetries: 3,
        retryDelay: 1000,
        autoReconnect: true,
        floodSleepThreshold: 60,
        useWSS: false,
        timeout: 10
      }
    );

    try {
      await client.connect();
      console.log('🔗 Cliente conectado');

      // Buscar informações do usuário atual (self) para salvar o chatId/telegramUserId
      let selfIdNumber: number | null = null;
      try {
        const meArr = await client.invoke(
          new Api.users.GetUsers({ id: [new Api.InputUserSelf()] })
        );
        const me = (meArr as any)[0];
        selfIdNumber = Number(me.id);

        // Persistir separadamente para evitar interromper o fluxo
        // 1) Tentativa de salvar no usuário (pode falhar se coluna ainda for INT)
        try {
          await prisma.user.update({
            where: { id: user.userId },
            data: { telegramUserId: selfIdNumber as unknown as bigint }
          });
          console.log('💾 user.telegramUserId salvo:', selfIdNumber);
        } catch (e) {
          console.warn('⚠️ Não foi possível salvar no User.telegramUserId (provável migração pendente):', e);
        }

        // 2) Salvar na credencial como string (coluna TEXT existente)
        try {
          await prisma.telegramCredential.update({
            where: { id: credential.id },
            data: { telegramUserId: String(selfIdNumber) }
          });
          console.log('💾 credential.telegramUserId salvo:', selfIdNumber);
        } catch (e) {
          console.warn('⚠️ Não foi possível salvar no TelegramCredential.telegramUserId:', e);
        }
      } catch (selfErr) {
        console.warn('⚠️ Não foi possível obter o telegramUserId (self):', selfErr);
      }

      // Tentar encontrar o bot por username obrigatório
      let botUser: any = null;
      try {
        const resolved = await client.invoke(
          new Api.contacts.ResolveUsername({ username: envBotUsername })
        );
        const peerUserId = (resolved as any)?.peer?.userId;
        const users = (resolved as any)?.users || [];
        botUser = users.find((u: any) => String(u.id) === String(peerUserId)) || users[0] || null;
      } catch (resolveError) {
        console.error('❌ Não foi possível resolver o username do bot:', resolveError);
        await client.disconnect();
        return NextResponse.json(
          { success: false, message: 'Não foi possível encontrar o bot. Verifique se TELEGRAM_BOT_USERNAME está configurado corretamente.' },
          { status: 500 }
        );
      }

      if (!botUser || !botUser.id || !botUser.accessHash) {
        await client.disconnect();
        return NextResponse.json(
          { success: false, message: 'Bot não encontrado ou dados insuficientes (accessHash ausente).' },
          { status: 404 }
        );
      }

      console.log('🤖 Bot encontrado:', botUser.username || envBotUsername);

      // Usar comando simples /start (sem token)
      const startCommand = `/start`;

      // Enviar mensagem /start para o bot com peer resolvido (id + accessHash corretos)
      try {
        await client.invoke(
          new Api.messages.SendMessage({
            peer: new Api.InputPeerUser({
              userId: botUser.id,
              accessHash: botUser.accessHash
            }),
            message: startCommand,
            randomId: bigInt.randBetween('1', '1000000000000000000')
          })
        );

        console.log('✅ Mensagem enviada para o bot');
        
        await client.disconnect();

        return NextResponse.json({
          success: true,
          message: 'Chat iniciado com sucesso! Verifique as mensagens do bot.',
          data: {
            botUsername: botUser.username || envBotUsername,
            command: startCommand,
            savedChatId: selfIdNumber ? String(selfIdNumber) : null
          }
        });

      } catch (sendError) {
        console.error('❌ Erro ao enviar mensagem:', sendError);
        await client.disconnect();
        
        return NextResponse.json(
          { success: false, message: 'Erro ao enviar mensagem para o bot' },
          { status: 500 }
        );
      }

    } catch (telegramError) {
      console.error('❌ Erro no cliente Telegram:', telegramError);
      await client.disconnect();
      
      return NextResponse.json(
        { success: false, message: 'Erro ao conectar com o Telegram' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}