import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import AuthService from '@/lib/auth/service';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { decrypt } from '@/lib/security/encryption';

const prisma = new PrismaClient();
const authService = new AuthService();

// Middleware de autenticação
async function authenticate(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);
    return result.success ? result.user : null;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

// GET - Buscar grupos/canais do Telegram
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Iniciando busca de grupos...');
    
    const user = await authenticate(request);
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('✅ Usuário autenticado:', user.id);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const credentialId = searchParams.get('credentialId');

    console.log('📝 Parâmetros recebidos:', { query, credentialId });

    if (!query || !credentialId) {
      console.log('❌ Parâmetros obrigatórios ausentes');
      return NextResponse.json(
        { error: 'Query e credentialId são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar credencial do usuário
    console.log('🔑 Buscando credencial...');
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id
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
        { error: 'Credencial ou sessão não encontrada' },
        { status: 404 }
      );
    }
    console.log('✅ Credencial e sessão encontradas:', credential.id);

    const sessionData = credential.sessions[0].sessionData;
    
    console.log('📊 Session data type:', typeof sessionData);
    console.log('📊 Session data length:', sessionData?.length);
    
    // Descriptografar dados da sessão
    const decryptedSessionData = decrypt(sessionData, user.id);
    console.log('🔓 Decrypted session type:', typeof decryptedSessionData);
    console.log('🔓 Decrypted session length:', decryptedSessionData?.length);
    console.log('🔓 Decrypted session preview:', decryptedSessionData?.substring(0, 50));
    
    // Extrair sessionString do JSON
    let sessionString = '';
    try {
      const sessionDataObj = JSON.parse(decryptedSessionData);
      sessionString = sessionDataObj.sessionString || '';
      console.log('🔓 Extracted session string length:', sessionString?.length);
      console.log('🔓 Session string preview:', sessionString?.substring(0, 50));
    } catch (error) {
      console.error('❌ Erro ao fazer parse da sessão:', error);
      return NextResponse.json(
        { error: 'Dados da sessão inválidos' },
        { status: 400 }
      );
    }
    
    // Descriptografar credenciais
    const decryptedApiId = decrypt(credential.apiId, user.id);
    const decryptedApiHash = decrypt(credential.apiHash, user.id);
    
    console.log('🔑 API ID:', decryptedApiId);
    console.log('🔑 API Hash length:', decryptedApiHash?.length);
    
    // Criar cliente Telegram com configurações otimizadas
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
      
      const groups = [];
      const processedIds = new Set();

      // Método 1: Buscar nos diálogos do usuário (mais confiável)
      console.log('Buscando nos diálogos do usuário...');
      try {
        const dialogs = await client.getDialogs({ limit: 200 });
        
        for (const dialog of dialogs) {
          const entity = dialog.entity as any;
          
          // Verificar se é um grupo/canal e se corresponde à busca
          if ((entity.className === 'Channel' || entity.className === 'Chat') &&
              entity.title?.toLowerCase().includes(query.toLowerCase())) {
            
            const groupId = entity.id.toString();
            if (!processedIds.has(groupId)) {
              processedIds.add(groupId);
              
              groups.push({
                id: groupId,
                title: entity.title || 'Sem título',
                type: entity.className === 'Channel' ? 
                      (entity.broadcast ? 'channel' : 
                       entity.megagroup ? 'supergroup' : 'channel') : 'group',
                memberCount: entity.participantsCount || 0,
                description: entity.about || '',
                isPrivate: !entity.username,
                username: entity.username || null
              });
            }
          }
        }
      } catch (dialogError) {
        console.error('Erro ao buscar diálogos:', dialogError);
      }

      // Método 2: Buscar usando contacts.search (para grupos públicos)
      console.log('Buscando grupos públicos...');
      try {
        const searchResults = await client.invoke(
          new Api.contacts.Search({
            q: query,
            limit: 50
          })
        );

        // Processar chats encontrados
        if ((searchResults as any).chats) {
          for (const chat of (searchResults as any).chats) {
            if (chat.className === 'Channel' || chat.className === 'Chat') {
              const chatInfo = chat as any;
              const groupId = chatInfo.id.toString();
              
              if (!processedIds.has(groupId)) {
                processedIds.add(groupId);
                
                groups.push({
                  id: groupId,
                  title: chatInfo.title || 'Sem título',
                  type: chatInfo.className === 'Channel' ? 
                        (chatInfo.broadcast ? 'channel' : 
                         chatInfo.megagroup ? 'supergroup' : 'channel') : 'group',
                  memberCount: chatInfo.participantsCount || 0,
                  description: chatInfo.about || '',
                  isPrivate: !chatInfo.username,
                  username: chatInfo.username || null
                });
              }
            }
          }
        }
      } catch (searchError) {
        console.error('Erro na busca por contacts.search:', searchError);
        // Não falhar se contacts.search não funcionar
      }

      // Método 3: Buscar usando messages.getDialogs com filtro (alternativo)
      if (groups.length === 0) {
        console.log('Tentando método alternativo...');
        try {
          const allDialogs = await client.invoke(
            new Api.messages.GetDialogs({
              offsetDate: 0,
              offsetId: 0,
              offsetPeer: new Api.InputPeerEmpty(),
              limit: 100,
              hash: 0 as any
            })
          ) as any;

          if (allDialogs.chats) {
            for (const chat of allDialogs.chats) {
              if ((chat.className === 'Channel' || chat.className === 'Chat') &&
                  chat.title?.toLowerCase().includes(query.toLowerCase())) {
                
                const chatInfo = chat as any;
                const groupId = chatInfo.id.toString();
                
                if (!processedIds.has(groupId)) {
                  processedIds.add(groupId);
                  
                  groups.push({
                    id: groupId,
                    title: chatInfo.title || 'Sem título',
                    type: chatInfo.className === 'Channel' ? 
                          (chatInfo.broadcast ? 'channel' : 
                           chatInfo.megagroup ? 'supergroup' : 'channel') : 'group',
                    memberCount: chatInfo.participantsCount || 0,
                    description: chatInfo.about || '',
                    isPrivate: !chatInfo.username,
                    username: chatInfo.username || null
                  });
                }
              }
            }
          }
        } catch (alternativeError) {
          console.error('Erro no método alternativo:', alternativeError);
        }
      }

      await client.disconnect();
      
      console.log(`Encontrados ${groups.length} grupos para a busca: "${query}"`);
      return NextResponse.json(groups.slice(0, 15)); // Limitar a 15 resultados
      
    } catch (telegramError) {
      console.error('Erro ao buscar no Telegram:', telegramError);
      await client.disconnect();
      
      return NextResponse.json(
        { error: 'Erro ao conectar com o Telegram' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}