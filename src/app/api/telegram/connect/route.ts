import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { decrypt, encrypt } from '@/lib/security/encryption';
import { getUserFromToken } from '@/lib/auth/utils';

const prisma = new PrismaClient();

/**
 * POST /api/telegram/connect
 * Conecta e autentica credenciais do Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, phoneCode, password } = body;

    if (!credentialId) {
      return NextResponse.json(
        { success: false, message: 'credentialId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar credencial do usuário
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.userId
      }
    });

    if (!credential) {
      return NextResponse.json(
        { success: false, message: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    // Descriptografar credenciais
    const decryptedApiId = decrypt(credential.apiId, user.userId);
    const decryptedApiHash = decrypt(credential.apiHash, user.userId);
    const decryptedPhoneNumber = decrypt(credential.phoneNumber, user.userId);

    // Verificar se já existe uma sessão temporária para esta credencial
    let existingSession = await prisma.telegramSession.findFirst({
      where: {
        credentialId,
        isActive: false // Sessão temporária
      }
    });

    let sessionString = '';
    if (existingSession) {
      try {
        const existingSessionData = JSON.parse(decrypt(existingSession.sessionData, user.userId));
        sessionString = existingSessionData.sessionString || '';
      } catch (e) {
        console.log('Erro ao recuperar sessão temporária, criando nova');
      }
    }

    // Criar cliente Telegram com sessão existente ou vazia e configurações otimizadas
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
      // Configurar log level para eliminar spam de logs
      // client.setLogLevel('none'); // Commented out due to type issues
      
      // Error handler personalizado para lidar com TIMEOUT
      const errorHandler = async function(error: any) {
        if (error.message && error.message === 'TIMEOUT') {
          // Não fazer nada para erros de TIMEOUT durante desconexão
          return;
        } else {
          console.error(`Erro no cliente Telegram:`, error);
        }
      };
      
      // Atribuir o error handler ao cliente
      (client as any)._errorHandler = errorHandler;
      
      // Se não temos código, redirecionar para enviar código via PUT
      if (!phoneCode) {
        return NextResponse.json({
          success: false,
          message: 'Código de verificação necessário. Use PUT /api/telegram/connect para enviar o código primeiro.',
          needsPhoneCode: true
        }, { status: 400 });
      }
      
      // Verificar se existe sessão temporária com phoneCodeHash
      if (!existingSession) {
        return NextResponse.json({
          success: false,
          message: 'Sessão não encontrada. Solicite um novo código de verificação.',
          needsNewCode: true
        }, { status: 400 });
      }
      
      // Recuperar dados da sessão temporária
      let retrievedSessionData;
      try {
        retrievedSessionData = JSON.parse(decrypt(existingSession.sessionData, user.userId));
      } catch (e) {
        return NextResponse.json({
          success: false,
          message: 'Sessão inválida. Solicite um novo código de verificação.',
          needsNewCode: true
        }, { status: 400 });
      }
      
      if (!retrievedSessionData.phoneCodeHash) {
        return NextResponse.json({
          success: false,
          message: 'Código de verificação não encontrado. Solicite um novo código.',
          needsNewCode: true
        }, { status: 400 });
      }
      
      await client.connect();
      
      // Tentar fazer login usando phoneCodeHash
      try {
        const authResult = await client.invoke(
          new (await import('telegram/tl')).Api.auth.SignIn({
             phoneNumber: decryptedPhoneNumber,
             phoneCodeHash: retrievedSessionData.phoneCodeHash,
             phoneCode: phoneCode
           })
        );
        
        // Verificar se precisa de 2FA
        if ('sessionPassword' in authResult) {
          if (!password) {
            await client.disconnect();
            return NextResponse.json({
              success: false,
              message: 'Autenticação de dois fatores necessária',
              needsPassword: true
            }, { status: 400 });
          }
          
          // Fazer login com senha 2FA
          const { computeCheck } = await import('telegram/Password');
          await client.invoke(
            new (await import('telegram/tl')).Api.auth.CheckPassword({
              password: await computeCheck(authResult.sessionPassword as any, password)
            })
          );
        }
      } catch (authError: any) {
        await client.disconnect();
        
        if (authError.message?.includes('PHONE_CODE_INVALID')) {
          return NextResponse.json({
            success: false,
            message: 'Código de verificação inválido. Tente novamente.',
            needsPhoneCode: true
          }, { status: 400 });
        }
        
        if (authError.message?.includes('PHONE_CODE_EXPIRED')) {
          // Remover sessão temporária
          await prisma.telegramSession.delete({
            where: { id: existingSession.id }
          });
          
          return NextResponse.json({
            success: false,
            message: 'Código de verificação expirado. Solicite um novo código.',
            needsNewCode: true
          }, { status: 400 });
        }
        
        throw authError;
      }
      
      // Se chegou aqui, autenticação foi bem-sucedida

      // Obter string da sessão
      const sessionString = (client.session.save() as unknown) as string;

      // Criar ou atualizar sessão no banco
      const finalSessionData = {
        sessionString,
        phoneNumber: decryptedPhoneNumber,
        apiId: decryptedApiId,
        apiHash: decryptedApiHash,
        connectedAt: new Date().toISOString()
      };

      // Criptografar dados da sessão
      const encryptedSessionData = encrypt(JSON.stringify(finalSessionData), user.userId);

      // Remover sessão temporária se existir
      if (existingSession) {
        await prisma.telegramSession.delete({
          where: { id: existingSession.id }
        });
      }
      
      // Criar sessão definitiva no banco
      await prisma.telegramSession.create({
        data: {
          credentialId,
          sessionData: encryptedSessionData,
          connectionLogs: JSON.stringify([{
            timestamp: new Date(),
            event: 'connect',
            message: 'Sessão criada e autenticada com sucesso'
          }]),
          isActive: true,
          lastUsed: new Date()
        }
      });

      // Atualizar status da credencial
      await prisma.telegramCredential.update({
        where: { id: credentialId },
        data: {
          status: 'CONNECTED',
          lastConnected: new Date(),
          lastError: null
        }
      });

      await client.disconnect();

      return NextResponse.json({
        success: true,
        message: 'Credenciais conectadas com sucesso',
        data: {
          credentialId,
          status: 'CONNECTED',
          sessionCreated: true
        }
      });

    } catch (error: any) {
      await client.disconnect();
      
      console.error('Erro na autenticação do Telegram:', error);
      
      // Verificar tipo de erro
      if (error.message?.includes('PHONE_CODE_INVALID')) {
        // Manter sessão temporária para nova tentativa
        return NextResponse.json(
          { success: false, message: 'Código de verificação inválido. Tente novamente.', needsPhoneCode: true },
          { status: 400 }
        );
      }
      
      if (error.message?.includes('PHONE_CODE_EXPIRED')) {
        // Remover sessão temporária e solicitar novo código
        if (existingSession) {
          await prisma.telegramSession.delete({
            where: { id: existingSession.id }
          });
        }
        return NextResponse.json(
          { success: false, message: 'Código de verificação expirado. Solicite um novo código.', needsNewCode: true },
          { status: 400 }
        );
      }
      
      if (error.message?.includes('PASSWORD_HASH_INVALID')) {
        return NextResponse.json(
          { success: false, message: 'Senha 2FA inválida', needsPassword: true },
          { status: 400 }
        );
      }
      
      if (error.message?.includes('2FA') || error.message?.includes('password')) {
        return NextResponse.json(
          { success: false, message: 'Autenticação de dois fatores necessária', needsPassword: true },
          { status: 400 }
        );
      }
      
      // Para outros erros, limpar sessão temporária e atualizar credencial
      if (existingSession) {
        await prisma.telegramSession.delete({
          where: { id: existingSession.id }
        });
      }
      
      await prisma.telegramCredential.update({
        where: { id: credentialId },
        data: {
          status: 'ERROR',
          lastError: error.message || 'Erro na autenticação'
        }
      });

      return NextResponse.json(
        { 
          success: false, 
          message: error.message || 'Erro na autenticação',
          needsPhoneCode: !phoneCode
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Erro ao conectar credenciais:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/telegram/connect
 * Envia código de verificação para o número de telefone
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId } = body;

    if (!credentialId) {
      return NextResponse.json(
        { success: false, message: 'credentialId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar credencial do usuário
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.userId
      }
    });

    if (!credential) {
      return NextResponse.json(
        { success: false, message: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    // Descriptografar credenciais
    const decryptedApiId = decrypt(credential.apiId, user.userId);
    const decryptedApiHash = decrypt(credential.apiHash, user.userId);
    const decryptedPhoneNumber = decrypt(credential.phoneNumber, user.userId);

    // Criar cliente Telegram com configurações otimizadas
    const client = new TelegramClient(
      new StringSession(''),
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
      // Configurar log level para eliminar spam de logs
      // client.setLogLevel('none'); // Commented out due to type issues
      
      // Error handler personalizado para lidar com TIMEOUT
      const errorHandler = async function(error: any) {
        if (error.message && error.message === 'TIMEOUT') {
          // Não fazer nada para erros de TIMEOUT durante desconexão
          return;
        } else {
          console.error(`Erro no cliente Telegram:`, error);
        }
      };
      
      // Atribuir o error handler ao cliente
      (client as any)._errorHandler = errorHandler;
      
      console.log('Iniciando conexão com Telegram...');
      await client.connect();
      console.log('Conexão estabelecida com sucesso');
      
      // Enviar código de verificação
      console.log('Enviando código de verificação...');
      const sentCode = await client.sendCode(
        {
          apiId: parseInt(decryptedApiId),
          apiHash: decryptedApiHash
        },
        decryptedPhoneNumber
      );
      console.log('Código enviado com sucesso');
      
      // Salvar informações da sessão temporária
      const tempSessionString = (client.session.save() as unknown) as string;
      const tempSessionData = {
        sessionString: tempSessionString,
        phoneNumber: decryptedPhoneNumber,
        apiId: decryptedApiId,
        apiHash: decryptedApiHash,
        phoneCodeHash: sentCode.phoneCodeHash,
        tempSession: true
      };
      
      const encryptedTempSessionData = encrypt(JSON.stringify(tempSessionData), user.userId);
      
      // Remover sessão temporária anterior se existir
      await prisma.telegramSession.deleteMany({
        where: {
          credentialId,
          isActive: false
        }
      });
      
      // Criar nova sessão temporária
      await prisma.telegramSession.create({
        data: {
          credentialId,
          sessionData: encryptedTempSessionData,
          connectionLogs: JSON.stringify([{
            timestamp: new Date(),
            event: 'code_sent',
            message: 'Código de verificação enviado'
          }]),
          isActive: false, // Sessão temporária
          lastUsed: new Date()
        }
      });

      await client.disconnect();

      return NextResponse.json({
        success: true,
        message: 'Código de verificação enviado com sucesso',
        data: {
          phoneNumber: decryptedPhoneNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1***$3'),
          codeSent: true
        }
      });

    } catch (error: any) {
      console.error('Erro durante conexão/envio de código:', error);
      
      try {
        await client.disconnect();
      } catch (disconnectError) {
        console.error('Erro ao desconectar cliente:', disconnectError);
      }
      
      let errorMessage = 'Erro ao enviar código de verificação';
      
      if (error.message?.includes('TIMEOUT')) {
        errorMessage = 'Timeout na conexão com o Telegram. Verifique sua conexão de internet e tente novamente.';
      } else if (error.message?.includes('PHONE_NUMBER_INVALID')) {
        errorMessage = 'Número de telefone inválido. Verifique o formato (+55 11 99999-9999).';
      } else if (error.message?.includes('API_ID_INVALID')) {
        errorMessage = 'API ID inválido. Verifique suas credenciais do Telegram.';
      } else if (error.message?.includes('API_HASH_INVALID')) {
        errorMessage = 'API Hash inválido. Verifique suas credenciais do Telegram.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: errorMessage
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Erro ao enviar código:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}