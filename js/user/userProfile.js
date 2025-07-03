import { getUsuarioAtual, getUsuarioId, getUsuarioNome, getUsuarioEmail, getUsuarioFoto, logout } from '../autenticacao.js';
import { showSuccess, showError, showLoading, hideLoading } from '../ui.js';

let db;
let storage;
// let auth; // auth is declared but not used in the new code, so it's commented out.
// let userMenuActive = false; // userMenuActive is declared but not used in the new code, so it's commented out.

// Função genérica para controlar um dropdown
function setupDropdown(buttonId, dropdownId, rotateIcon = false) {
    const button = document.getElementById(buttonId);
    const dropdown = document.getElementById(dropdownId);
    if (!button || !dropdown) return;

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.toggle('hidden');
        
        if (rotateIcon) {
            const icon = button.querySelector('[data-lucide]');
            if (icon) {
                icon.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-up');
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!button.contains(event.target) && !dropdown.contains(event.target)) {
            if (!dropdown.classList.contains('hidden')) {
                dropdown.classList.add('hidden');
                if (rotateIcon) {
                    const icon = button.querySelector('[data-lucide]');
                    if (icon) {
                        icon.setAttribute('data-lucide', 'chevron-down');
                        if (window.lucide) window.lucide.createIcons();
                    }
                }
            }
        }
    });
    return dropdown;
}

// Configura o menu principal "Construktor"
function setupConstruktorMenu() {
    setupDropdown('construktor-menu-button', 'construktor-menu-dropdown', true);
}

// Configura o menu de Configurações (engrenagem)
function setupSettingsMenu() {
    const dropdown = setupDropdown('settings-menu-button', 'settings-menu-dropdown');
    if (!dropdown) return;

    // Adiciona a lógica específica para os botões deste menu
    dropdown.querySelector('#edit-profile-button').addEventListener('click', () => {
        dropdown.classList.add('hidden');
        openProfileModal();
    });

    dropdown.querySelector('#logout-button').addEventListener('click', async () => {
        dropdown.classList.add('hidden');
        await logout();
    });
}

/**
 * Configura o modal de perfil
 */
function setupProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    const closeProfileModal = document.getElementById('close-profile-modal');
    const cancelProfileButton = document.getElementById('cancel-profile-button');
    const saveProfileButton = document.getElementById('save-profile-button');
    const changeAvatarButton = document.getElementById('change-avatar-button');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    
    // Fechar o modal
    const closeModal = () => {
        profileModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            profileModal.classList.add('hidden');
        }, 300);
    };
    
    // Abrir o modal
    window.openProfileModal = () => {
        profileModal.classList.remove('hidden');
        setTimeout(() => {
            profileModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);
    };
    
    closeProfileModal.addEventListener('click', closeModal);
    cancelProfileButton.addEventListener('click', closeModal);
    
    // Tratamento do upload de avatar
    changeAvatarButton.addEventListener('click', () => {
        avatarUploadInput.click();
    });
    
    avatarUploadInput.addEventListener('change', handleAvatarUpload);
    
    // Salvar alterações no perfil
    saveProfileButton.addEventListener('click', saveUserProfile);
}

/**
 * Carrega os dados do perfil do usuário
 */
async function loadUserProfileData() {
    const currentUser = getUsuarioAtual();
    if (!currentUser) return;
    
    const userId = getUsuarioId();
    const userDisplayName = document.getElementById('user-display-name');
    const userAvatarPreview = document.getElementById('user-avatar-preview');
    const modalAvatarPreview = document.getElementById('modal-avatar-preview');
    const nicknameInput = document.getElementById('nickname-input');
    const emailInput = document.getElementById('email-input');
    
    try {
        // Tenta buscar os dados do usuário no Firestore
        const snapshot = await db.doc(`users/${userId}`).get();
        const userData = snapshot.exists ? snapshot.data() : {};
        
        // Define os valores nos elementos da UI
        const displayName = userData.displayName || getUsuarioNome() || 'Usuário';
        userDisplayName.textContent = displayName;
        nicknameInput.value = displayName;
        emailInput.value = getUsuarioEmail() || '';
        
        // Define a imagem do avatar
        const photoURL = userData.photoURL || getUsuarioFoto() || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
        userAvatarPreview.src = photoURL;
        modalAvatarPreview.src = photoURL;
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        
        // Valores padrão em caso de erro
        const displayName = getUsuarioNome() || 'Usuário';
        userDisplayName.textContent = displayName;
        nicknameInput.value = displayName;
        emailInput.value = getUsuarioEmail() || '';
        
        // Avatar padrão em caso de erro
        const photoURL = getUsuarioFoto() || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
        userAvatarPreview.src = photoURL;
        modalAvatarPreview.src = photoURL;
    }
}

/**
 * Manipula o upload do avatar
 * @param {Event} event - Evento de change do input file
 */
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verifica se é uma imagem
    if (!file.type.startsWith('image/')) {
        showError('Arquivo inválido', 'Por favor, selecione uma imagem.');
        return;
    }
    
    // Verifica o tamanho da imagem (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showError('Arquivo muito grande', 'O tamanho máximo permitido é 2MB.');
        return;
    }
    
    try {
        showLoading('Processando imagem...');
        
        // Exibe uma prévia da imagem
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('modal-avatar-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erro', 'Ocorreu um erro ao processar a imagem.');
    }
}

/**
 * Salva as alterações no perfil do usuário
 */
async function saveUserProfile() {
    const userId = getUsuarioId();
    if (!userId) {
        showError('Erro', 'Usuário não está autenticado.');
        return;
    }
    
    const newNickname = document.getElementById('nickname-input').value.trim();
    const avatarFile = document.getElementById('avatar-upload-input').files[0];
    
    if (!newNickname) {
        showError('Erro', 'O apelido não pode estar vazio.');
        return;
    }
    
    showLoading('Salvando perfil...');
    
    try {
        // Dados a serem atualizados
        const updateData = {
            displayName: newNickname,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Se houver um arquivo de avatar, faz o upload
        if (avatarFile) {
            try {
                // Cria uma referência no storage para o avatar
                const storageRef = storage.ref(`user-avatars/${userId}`);
                const fileRef = storageRef.child(`avatar-${Date.now()}`);
                
                // Faz o upload do arquivo
                await fileRef.put(avatarFile);
                
                // Obtém a URL do arquivo
                const downloadURL = await fileRef.getDownloadURL();
                updateData.photoURL = downloadURL;
            } catch (uploadError) {
                console.error('Erro no upload do avatar:', uploadError);
                showError('Erro no upload', 'Não foi possível fazer o upload da imagem.');
                hideLoading();
                return;
            }
        }
        
        // Atualiza os dados no banco
        await db.doc(`users/${userId}`).update(updateData);
        
        // Atualiza a interface
        document.getElementById('user-display-name').textContent = newNickname;
        if (updateData.photoURL) {
            document.getElementById('user-avatar-preview').src = updateData.photoURL;
        }
        
        // Fecha o modal e exibe mensagem de sucesso
        document.getElementById('profile-modal').classList.add('hidden');
        hideLoading();
        showSuccess('Perfil atualizado', 'Suas informações foram atualizadas com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        hideLoading();
        showError('Erro', 'Ocorreu um erro ao salvar seu perfil.');
    }
}

/**
 * Retorna os dados do perfil do usuário atual
 * @returns {Promise<Object>} Dados do perfil do usuário
 */
export async function getUserProfileData() {
    const userId = getUsuarioId();
    if (!userId) {
        return null;
    }
    
    try {
        const snapshot = await db.doc(`users/${userId}`).get();
        return snapshot.exists ? snapshot.data() : {};
    } catch (error) {
        console.error('Erro ao obter dados do perfil:', error);
        return null;
    }
}

// Função de inicialização principal do módulo
export function initUserProfile(database) {
    db = database;
    storage = firebase.storage(); // Initialize storage here
    // auth = firebase.auth(); // auth is not used in the new code

    setupConstruktorMenu();
    setupSettingsMenu();

    setupProfileModal();
    loadUserProfileData();
}