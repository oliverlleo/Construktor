import { firebaseConfig } from './config.js';

// Variáveis do módulo
let auth;
let confirmationResult = null;

// Função de inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    
    // Inicializa ícones Lucide
    if (typeof lucide !== 'undefined' && lucide) {
        lucide.createIcons();
    }
    
    // Verifica se já há um usuário logado
    auth.onAuthStateChanged(user => {
        if (user) {
            // Usuário já autenticado, redireciona para a página principal
            window.location.href = '../index.html';
        }
    });
    
    // Configura navegação por abas
    setupTabNavigation();
    
    // Configura os botões de login
    setupLoginButtons();
    
    // Configura verificação por telefone
    setupPhoneVerification();
    
    // Configura recuperação de senha
    setupPasswordRecovery();
});

// Configuração das abas
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove a classe ativa de todas as abas
            tabs.forEach(t => t.classList.remove('active'));
            
            // Adiciona a classe ativa à aba clicada
            tab.classList.add('active');
            
            // Esconde todos os painéis
            document.querySelectorAll('.auth-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
            
            // Mostra o painel correspondente à aba clicada
            const targetId = `content-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.remove('hidden');
            
            // Esconde outros painéis especiais
            document.getElementById('phone-verification-panel').classList.add('hidden');
            document.getElementById('password-recovery-panel').classList.add('hidden');
        });
    });
}

// Configuração dos botões de login
function setupLoginButtons() {
    // Login com Google
    const googleLoginBtn = document.getElementById('google-login');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', loginWithGoogle);
    }
    
    // Login com Email/Senha
    const emailLoginBtn = document.getElementById('email-login-btn');
    if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showError('Campos obrigatórios', 'Por favor, preencha todos os campos.');
                return;
            }
            
            loginWithEmailPassword(email, password);
        });
    }
    
    // Login com telefone
    const phoneLoginBtn = document.getElementById('phone-login');
    if (phoneLoginBtn) {
        phoneLoginBtn.addEventListener('click', () => {
            // Esconde os painéis padrão
            document.querySelectorAll('.auth-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
            
            // Mostra o painel de verificação por telefone
            document.getElementById('phone-verification-panel').classList.remove('hidden');
            document.getElementById('phone-step-1').classList.remove('hidden');
            document.getElementById('phone-step-2').classList.add('hidden');
        });
    }
    
    // Botão de voltar ao login
    const backToLoginBtn = document.getElementById('back-to-login');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            // Esconde o painel de verificação
            document.getElementById('phone-verification-panel').classList.add('hidden');
            
            // Mostra o painel de login
            document.getElementById('content-login').classList.remove('hidden');
            
            // Redefine as abas
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('tab-register').classList.remove('active');
        });
    }
    
    // Botão de esqueci minha senha
    const forgotPasswordBtn = document.getElementById('forgot-password');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Esconde os painéis padrão
            document.querySelectorAll('.auth-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
            
            // Mostra o painel de recuperação de senha
            document.getElementById('password-recovery-panel').classList.remove('hidden');
        });
    }
    
    // Registro de nova conta
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            
            if (!email || !password || !confirmPassword) {
                showError('Campos obrigatórios', 'Por favor, preencha todos os campos.');
                return;
            }
            
            if (password !== confirmPassword) {
                showError('Senhas diferentes', 'As senhas não coincidem.');
                return;
            }
            
            registerWithEmailPassword(email, password);
        });
    }
}

// Configuração de verificação por telefone
function setupPhoneVerification() {
    // Configuração do recaptcha
    const recaptchaContainer = document.getElementById('recaptcha-container');
    
    // Botão para enviar código
    const sendCodeBtn = document.getElementById('send-code-btn');
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', () => {
            const phoneNumber = document.getElementById('phone-number').value;
            
            if (!phoneNumber) {
                showError('Número inválido', 'Por favor, digite um número de telefone válido.');
                return;
            }
            
            // Configura o reCAPTCHA
            const appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'normal',
                'callback': (response) => {
                    // reCAPTCHA resolvido, o usuário pode continuar
                    sendVerificationCode(phoneNumber, appVerifier);
                },
                'expired-callback': () => {
                    // O reCAPTCHA expirou
                    showError('Verificação expirada', 'A verificação expirou. Tente novamente.');
                }
            });
            
            // Renderiza o reCAPTCHA
            appVerifier.render().then(widgetId => {
                window.recaptchaWidgetId = widgetId;
            });
        });
    }
    
    // Configuração dos inputs de código de verificação
    const codeInputs = document.querySelectorAll('.verification-code-input');
    codeInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // Move para o próximo input automaticamente
            const index = parseInt(e.target.dataset.index);
            if (e.target.value && index < 6) {
                document.querySelector(`.verification-code-input[data-index="${index + 1}"]`).focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            // Move para o input anterior ao pressionar Backspace em um input vazio
            const index = parseInt(e.target.dataset.index);
            if (e.key === 'Backspace' && !e.target.value && index > 1) {
                document.querySelector(`.verification-code-input[data-index="${index - 1}"]`).focus();
            }
        });
    });
    
    // Botão para verificar código
    const verifyCodeBtn = document.getElementById('verify-code-btn');
    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', () => {
            let verificationCode = '';
            codeInputs.forEach(input => {
                verificationCode += input.value;
            });
            
            if (verificationCode.length !== 6) {
                showError('Código inválido', 'Por favor, digite o código de 6 dígitos completo.');
                return;
            }
            
            verifyCode(verificationCode);
        });
    }
    
    // Botão para reenviar código
    const resendCodeBtn = document.getElementById('resend-code-btn');
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', () => {
            const phoneNumber = document.getElementById('phone-number').value;
            
            if (!phoneNumber) {
                showError('Número inválido', 'Por favor, digite um número de telefone válido.');
                return;
            }
            
            // Reconfigura o reCAPTCHA
            const appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'normal',
                'callback': (response) => {
                    // reCAPTCHA resolvido, o usuário pode continuar
                    sendVerificationCode(phoneNumber, appVerifier);
                }
            });
            
            // Renderiza o reCAPTCHA novamente
            appVerifier.render().then(widgetId => {
                window.recaptchaWidgetId = widgetId;
            });
        });
    }
}

// Configuração de recuperação de senha
function setupPasswordRecovery() {
    // Botão para enviar link de recuperação
    const sendRecoveryBtn = document.getElementById('send-recovery-btn');
    if (sendRecoveryBtn) {
        sendRecoveryBtn.addEventListener('click', () => {
            const email = document.getElementById('recovery-email').value;
            
            if (!email) {
                showError('Email obrigatório', 'Por favor, digite seu email.');
                return;
            }
            
            sendPasswordResetEmail(email);
        });
    }
    
    // Botão para voltar ao login
    const backToLoginFromRecoveryBtn = document.getElementById('back-to-login-from-recovery');
    if (backToLoginFromRecoveryBtn) {
        backToLoginFromRecoveryBtn.addEventListener('click', () => {
            // Esconde o painel de recuperação
            document.getElementById('password-recovery-panel').classList.add('hidden');
            
            // Mostra o painel de login
            document.getElementById('content-login').classList.remove('hidden');
            
            // Redefine as abas
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('tab-register').classList.remove('active');
        });
    }
}

// Funções de autenticação

// Login com Google
async function loginWithGoogle() {
    try {
        showLoading('Conectando ao Google...');
        
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        
        // Não precisa de redirecionamento pois o onAuthStateChanged já faz isso
    } catch (error) {
        hideLoading();
        console.error("Erro no login com Google:", error);
        
        let errorMessage = 'Ocorreu um erro ao fazer login com Google.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'O popup de login foi fechado. Tente novamente.';
        }
        
        showError('Erro no login', errorMessage);
    }
}

// Login com Email/Senha
async function loginWithEmailPassword(email, password) {
    try {
        showLoading('Entrando...');
        
        await auth.signInWithEmailAndPassword(email, password);
        
        // Não precisa de redirecionamento pois o onAuthStateChanged já faz isso
    } catch (error) {
        hideLoading();
        console.error("Erro no login com email:", error);
        
        let errorMessage = 'Ocorreu um erro ao fazer login.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Email ou senha incorretos.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
        }
        
        showError('Erro no login', errorMessage);
    }
}

// Registro com Email/Senha
async function registerWithEmailPassword(email, password) {
    try {
        showLoading('Criando conta...');
        
        await auth.createUserWithEmailAndPassword(email, password);
        
        // Não precisa de redirecionamento pois o onAuthStateChanged já faz isso
    } catch (error) {
        hideLoading();
        console.error("Erro no registro:", error);
        
        let errorMessage = 'Ocorreu um erro ao criar a conta.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está sendo usado por outra conta.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        }
        
        showError('Erro no registro', errorMessage);
    }
}

// Enviar código de verificação para telefone
async function sendVerificationCode(phoneNumber, appVerifier) {
    try {
        showLoading('Enviando código...');
        
        confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier);
        
        hideLoading();
        
        // Avança para o próximo passo
        document.getElementById('phone-step-1').classList.add('hidden');
        document.getElementById('phone-step-2').classList.remove('hidden');
        
        // Foca no primeiro input do código
        document.querySelector('.verification-code-input[data-index="1"]').focus();
        
        showSuccess('Código enviado!', 'Um código de verificação foi enviado para o número informado.');
    } catch (error) {
        hideLoading();
        console.error("Erro ao enviar código:", error);
        
        let errorMessage = 'Ocorreu um erro ao enviar o código de verificação.';
        if (error.code === 'auth/invalid-phone-number') {
            errorMessage = 'Número de telefone inválido. Use o formato +55DDD00000000';
        } else if (error.code === 'auth/quota-exceeded') {
            errorMessage = 'Quota excedida. Tente novamente mais tarde.';
        }
        
        showError('Erro ao enviar código', errorMessage);
    }
}

// Verificar código recebido
async function verifyCode(verificationCode) {
    if (!confirmationResult) {
        showError('Erro de verificação', 'Sessão de verificação expirada. Por favor, solicite um novo código.');
        return;
    }
    
    try {
        showLoading('Verificando código...');
        
        await confirmationResult.confirm(verificationCode);
        
        // Não precisa de redirecionamento pois o onAuthStateChanged já faz isso
    } catch (error) {
        hideLoading();
        console.error("Erro na verificação do código:", error);
        
        let errorMessage = 'Ocorreu um erro ao verificar o código.';
        if (error.code === 'auth/invalid-verification-code') {
            errorMessage = 'Código de verificação inválido.';
        } else if (error.code === 'auth/code-expired') {
            errorMessage = 'Código de verificação expirado. Solicite um novo código.';
        }
        
        showError('Erro na verificação', errorMessage);
    }
}

// Enviar email de recuperação de senha
async function sendPasswordResetEmail(email) {
    try {
        showLoading('Enviando email...');
        
        await auth.sendPasswordResetEmail(email);
        
        hideLoading();
        showSuccess('Email enviado!', 'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.');
        
        // Volta para a tela de login após alguns segundos
        setTimeout(() => {
            document.getElementById('password-recovery-panel').classList.add('hidden');
            document.getElementById('content-login').classList.remove('hidden');
        }, 3000);
    } catch (error) {
        hideLoading();
        console.error("Erro ao enviar email de recuperação:", error);
        
        let errorMessage = 'Ocorreu um erro ao enviar o email de recuperação.';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'Não existe conta com este email.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        }
        
        showError('Erro no envio', errorMessage);
    }
}

// Funções auxiliares
function showLoading(message = 'Carregando...') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: message,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }
}

function hideLoading() {
    if (typeof Swal !== 'undefined') {
        Swal.close();
    }
}

function showSuccess(title, message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message
        });
    } else {
        alert(`${title}: ${message}`);
    }
}

function showError(title, message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: title,
            text: message
        });
    } else {
        alert(`Erro - ${title}: ${message}`);
    }
}