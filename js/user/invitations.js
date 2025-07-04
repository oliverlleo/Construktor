/**
 * Módulo de gerenciamento de convites
 * Responsável por criar, aceitar e recusar convites para usuários
 */

import { getUsuarioAtual, getUsuarioId, getUsuarioNome, getUsuarioEmail } from '../autenticacao.js';
import { showSuccess, showError, showLoading, hideLoading } from '../ui.js';
import { getUserProfileData } from './userProfile.js';

// Variáveis do módulo
let db;
let activeTab = 'sent';

/**
 * Inicializa o módulo de convites
 * @param {Object} database - Referência ao banco de dados Firestore
 */
export function initInvitations(database) {
    console.log('Inicializando módulo de convites...');
    db = database;
    
    // Adiciona verificações para garantir que os elementos existem antes de adicionar listeners
    if (document.getElementById('invite-modal')) {
        setupInviteModal();
    }
    if (document.getElementById('manage-invites-modal')) {
        setupManageInvitesModal();
    }
}

/**
 * Configura o modal de convite
 */
function setupInviteModal() {
    const inviteModal = document.getElementById('invite-modal');
    const inviteUserButton = document.getElementById('invite-user-button');
    const closeInviteModal = document.getElementById('close-invite-modal');
    const cancelInviteButton = document.getElementById('cancel-invite-button');
    const sendInviteButton = document.getElementById('send-invite-button');
    
    // Verifica se todos os elementos necessários existem
    if (!inviteModal || !inviteUserButton || !closeInviteModal || !cancelInviteButton || !sendInviteButton) {
        console.error("Um ou mais elementos do modal de convite não foram encontrados.");
        return;
    }

    // Abrir o modal
    inviteUserButton.addEventListener('click', () => {
        const userMenuDropdown = document.getElementById('user-menu-dropdown');
        if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
        
        inviteModal.classList.remove('hidden');
        setTimeout(() => {
            const modalContent = inviteModal.querySelector('.bg-white');
            if (modalContent) modalContent.classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        // Limpa o campo de email
        const emailInput = document.getElementById('invite-email-input');
        if (emailInput) emailInput.value = '';
    });
    
    // Fechar o modal
    const closeModal = () => {
        const modalContent = inviteModal.querySelector('.bg-white');
        if (modalContent) modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            inviteModal.classList.add('hidden');
        }, 300);
    };
    
    closeInviteModal.addEventListener('click', closeModal);
    cancelInviteButton.addEventListener('click', closeModal);
    
    // Enviar convite
    sendInviteButton.addEventListener('click', sendInvite);
}

/**
 * Configura o modal de gerenciamento de convites
 */
function setupManageInvitesModal() {
    const manageInvitesModal = document.getElementById('manage-invites-modal');
    const manageInvitesButton = document.getElementById('manage-invites-button');
    const closeManageInvitesModal = document.getElementById('close-manage-invites-modal');
    const tabInvitesSent = document.getElementById('tab-invites-sent');
    const tabInvitesReceived = document.getElementById('tab-invites-received');
    const tabInvitesAccess = document.getElementById('tab-invites-access');
    
    if (!manageInvitesModal || !manageInvitesButton || !closeManageInvitesModal || !tabInvitesSent || !tabInvitesReceived || !tabInvitesAccess) {
        console.error("Um ou mais elementos do modal de gerenciamento de convites não foram encontrados.");
        return;
    }

    // Abrir o modal
    manageInvitesButton.addEventListener('click', async () => {
        const userMenuDropdown = document.getElementById('user-menu-dropdown');
        if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
        
        manageInvitesModal.classList.remove('hidden');
        setTimeout(() => {
            const modalContent = manageInvitesModal.querySelector('.bg-white');
            if (modalContent) modalContent.classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        const pendingCount = await checkPendingInvitations();
        
        if (pendingCount > 0 && activeTab !== 'received') {
            activeTab = 'received';
            updateInvitesTabUI();
        }
        
        if (activeTab === 'access') {
            await loadSharedAccess();
        } else {
            await loadInvites(activeTab);
        }
    });
    
    // Fechar o modal
    closeManageInvitesModal.addEventListener('click', () => {
        const modalContent = manageInvitesModal.querySelector('.bg-white');
        if (modalContent) modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            manageInvitesModal.classList.add('hidden');
        }, 300);
    });
    
    // Alternar entre as abas
    tabInvitesSent.addEventListener('click', () => {
        if (activeTab === 'sent') return;
        activeTab = 'sent';
        updateInvitesTabUI();
        loadInvites('sent');
    });
    
    tabInvitesReceived.addEventListener('click', () => {
        if (activeTab === 'received') return;
        activeTab = 'received';
        updateInvitesTabUI();
        loadInvites('received');
    });
    
    tabInvitesAccess.addEventListener('click', () => {
        if (activeTab === 'access') return;
        activeTab = 'access';
        updateInvitesTabUI();
        loadSharedAccess();
    });
    
    // Delegação de eventos para os convites e acessos
    manageInvitesModal.addEventListener('click', async (event) => {
        const target = event.target;
        const card = target.closest('.invite-card, .shared-access-item');
        if (!card) return;

        const inviteId = card.dataset.inviteId;
        if (!inviteId) return; // Verificação adicional

        if (target.closest('.cancel-invite-btn')) await manageInvite(inviteId, 'cancel');
        if (target.closest('.accept-invite-btn')) await manageInvite(inviteId, 'accept');
        if (target.closest('.decline-invite-btn')) await manageInvite(inviteId, 'decline');
        
        if (target.closest('.save-permission-btn')) {
            const newRole = card.querySelector('.permission-select')?.value;
            if (newRole) {
                await updateUserPermission(inviteId, newRole);
                target.closest('.save-permission-btn').classList.add('hidden');
            }
        }

        if (target.closest('.remove-access-btn')) {
            const email = card.dataset.email;
            const confirmRemove = await Swal.fire({
                title: 'Remover acesso?',
                text: `Tem a certeza que deseja remover o acesso de ${email}?`,
                icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, remover',
                cancelButtonText: 'Cancelar', confirmButtonColor: '#d33'
            });
            if (confirmRemove.isConfirmed) await manageInvite(inviteId, 'revoke');
        }
    });
}

/**
 * Atualiza a UI das abas de convites
 */
function updateInvitesTabUI() {
    const tabs = {
        sent: document.getElementById('tab-invites-sent'),
        received: document.getElementById('tab-invites-received'),
        access: document.getElementById('tab-invites-access')
    };
    const containers = {
        sent: document.getElementById('sent-invites-container'),
        received: document.getElementById('received-invites-container'),
        access: document.getElementById('access-management-container')
    };
    
    for (const key in tabs) {
        if (tabs[key] && containers[key]) {
            const isTabActive = key === activeTab;
            tabs[key].classList.toggle('border-indigo-600', isTabActive);
            tabs[key].classList.toggle('text-indigo-600', isTabActive);
            tabs[key].classList.toggle('border-slate-200', !isTabActive);
            tabs[key].classList.toggle('text-slate-500', !isTabActive);
            containers[key].classList.toggle('hidden', !isTabActive);
        }
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Envia um convite para outro usuário.
 */
async function sendInvite() {
    const emailInput = document.getElementById('invite-email-input');
    const permissionSelect = document.getElementById('permission-select');
    const email = emailInput.value.trim().toLowerCase();
    const permission = permissionSelect.value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === getUsuarioEmail()?.toLowerCase()) {
        showError('Erro', 'Por favor, insira um e-mail válido e diferente do seu.');
        return;
    }

    const currentWorkspace = window.getCurrentWorkspace ? window.getCurrentWorkspace() : null;
    if (!currentWorkspace) {
        showError('Erro', 'Nenhuma área de trabalho selecionada para compartilhar.');
        return;
    }

    showLoading('Enviando convite...');

    try {
        const currentUserProfile = await getUserProfileData();
        const senderName = currentUserProfile.displayName || getUsuarioNome() || "Usuário Anônimo";
        const inviteData = {
            fromUserId: getUsuarioId(),
            fromUserName: senderName,
            toEmail: email,
            toUserId: null,
            resourceType: 'workspace',
            resourceId: currentWorkspace.id,
            resourceName: currentWorkspace.name,
            role: permission,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('invitations').add(inviteData);
        document.getElementById('invite-modal').classList.add('hidden');
        hideLoading();
        showSuccess('Convite enviado', `Um convite foi enviado para ${email}.`);
        if (activeTab === 'sent') {
            await loadInvites('sent');
        }

    } catch (error) {
        console.error('Erro ao enviar convite:', error);
        hideLoading();
        showError('Erro no Envio', 'Ocorreu um erro ao criar o convite.');
    }
}

/**
 * Gere uma ação num convite (aceitar, recusar, cancelar, revogar).
 * @param {string} inviteId - ID do convite
 * @param {string} action - Ação a ser executada
 */
async function manageInvite(inviteId, action) {
    // ===== INÍCIO DA CORREÇÃO DEFINITIVA =====
    // Esta verificação garante que a função só execute
    // se o usuário estiver 100% autenticado.
    const user = firebase.auth().currentUser;
    if (!user) {
        showError("Erro de Autenticação", "Sua sessão parece ter expirado ou ainda não foi confirmada. Por favor, aguarde um momento ou tente fazer login novamente.");
        hideLoading(); // Esconde o loading se ele estiver visível
        return; 
    }
    // ===== FIM DA CORREÇÃO DEFINITIVA =====

    showLoading('Processando...');
    try {
        const inviteSnapshot = await db.doc(`invitations/${inviteId}`).get();
        if (!inviteSnapshot.exists) throw new Error("Convite não encontrado.");
        const inviteData = inviteSnapshot.data();
        
        const batch = db.batch();
        
        if (action === 'accept') {
            const acceptedByUserId = getUsuarioId(); // Agora garantimos que esta função retornará um ID válido
            if (!acceptedByUserId) throw new Error("ID do usuário não encontrado. Tente novamente.");

            batch.update(db.doc(`invitations/${inviteId}`), {
                status: 'accepted',
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
                toUserId: acceptedByUserId
            });
            
            
            if (inviteData.resourceType === 'workspace') {
                // SharedWorkspaces is updated by Cloud Function 'onInviteAccepted'.
            }
        } else if (action === 'revoke') {
            const invitedUserId = inviteData.toUserId;
            if (invitedUserId) {
                // Access removal is handled by Cloud Function 'onRoleUpdated'.
            } else {
                console.warn("Não foi possível revogar o acesso: toUserId não encontrado no convite.");
            }
            batch.update(db.doc(`invitations/${inviteId}`), {
                status: 'revoked'
            });
        } else {
            batch.update(db.doc(`invitations/${inviteId}`), {
                status: action === 'decline' ? 'declined' : 'canceled'
            });
        }

        await batch.commit();
        hideLoading();
        showSuccess('Sucesso!', 'O convite foi processado.');

        // Recarrega a aba atual
        if (activeTab === 'access') await loadSharedAccess();
        else await loadInvites(activeTab);
        
        if (action === 'accept' || action === 'decline') await checkPendingInvitations();

    } catch (error) {
        console.error(`Erro ao executar a ação '${action}':`, error);
        hideLoading();
        showError('Erro', `Ocorreu um erro ao processar o convite: ${error.message}`);
    }
}


/**
 * Atualiza a permissão de um utilizador.
 * @param {string} inviteId - O ID do convite original aceite
 * @param {string} newRole - A nova permissão
 */
async function updateUserPermission(inviteId, newRole) {
    // Adiciona a mesma verificação de segurança aqui
    const user = firebase.auth().currentUser;
    if (!user) {
        showError("Erro de Autenticação", "Sua sessão expirou. Por favor, faça login novamente.");
        return;
    }

    showLoading('Atualizando permissão...');
    try {
        const inviteSnapshot = await db.doc(`invitations/${inviteId}`).get();
        if (!inviteSnapshot.exists) throw new Error("Convite não encontrado");
        
        const inviteData = inviteSnapshot.data();
        if (inviteData.fromUserId !== getUsuarioId()) throw new Error("Apenas o dono do convite pode alterar a permissão.");
        if (inviteData.status !== 'accepted') throw new Error("Só é possível alterar permissões de convites já aceitos.");
        
        const invitedUserId = inviteData.toUserId;
        if (!invitedUserId) throw new Error("O ID do usuário convidado não foi encontrado. O convite pode não ter sido devidamente aceito.");

        const batch = db.batch();
        batch.update(db.doc(`invitations/${inviteId}`), { role: newRole });
        // AccessControl is updated by Cloud Function 'onRoleUpdated'.

        await batch.commit();
        hideLoading();
        showSuccess('Permissão atualizada!');
        await loadSharedAccess();
        
    } catch (error) {
        console.error('Erro ao atualizar permissão:', error);
        hideLoading();
        showError('Erro na Atualização', error.message);
    }
}

/**
 * Carrega os convites enviados ou recebidos
 * @param {string} type - Tipo de convites a carregar: 'sent' ou 'received'
 */
async function loadInvites(type) {
    const userId = getUsuarioId();
    const userEmail = getUsuarioEmail()?.toLowerCase();
    if (!userId || !userEmail) {
        console.warn("loadInvites: Usuário não autenticado ou sem email.");
        return;
    }
    
    showLoading(`Carregando convites...`);
    
    try {
        const queryField = type === 'sent' ? 'fromUserId' : 'toEmail';
        const queryValue = type === 'sent' ? userId : userEmail;
        const query = db.collection('invitations').where(queryField, '==', queryValue);
        
        const snapshot = await query.get();
        let invites = [];
        snapshot.forEach(doc => {
            invites.push({ id: doc.id, ...doc.data() });
        });

        if (type === 'received') {
            invites = invites.filter(invite => invite.status === 'pending');
        }
        
        renderInvites(invites.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), type);
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error(`Erro ao carregar convites (${type}):`, error);
        showError('Erro', `Ocorreu um erro ao carregar os convites.`);
    }
}

/**
 * Renderiza os convites na interface
 * @param {Array} invites - Lista de convites
 * @param {string} type - Tipo de convites: 'sent' ou 'received'
 */
function renderInvites(invites, type) {
    const containerId = `${type}-invites-list`;
    const emptyId = `no-${type}-invites`;
    const container = document.getElementById(containerId);
    const emptyContainer = document.getElementById(emptyId);
    
    if (!container || !emptyContainer) return;

    container.innerHTML = '';
    container.classList.toggle('hidden', invites.length === 0);
    emptyContainer.classList.toggle('hidden', invites.length > 0);

    if(invites.length > 0) {
        const templateId = type === 'sent' ? 'sent-invite-template' : 'received-invite-template';
        const template = document.getElementById(templateId);
        if (!template) return;

        invites.forEach(invite => {
            const clone = document.importNode(template.content, true);
            const card = clone.querySelector('.invite-card');
            card.dataset.inviteId = invite.id;

            if (type === 'sent') {
                card.querySelector('.invite-email').textContent = invite.toEmail;
                const statusBadge = card.querySelector('.invite-status-badge');
                const { badgeClass, statusText } = getStatusBadgeInfo(invite.status);
                statusBadge.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`;
                statusBadge.textContent = statusText;
                card.querySelector('.cancel-invite-container').style.display = invite.status === 'pending' ? '' : 'none';
            } else {
                card.querySelector('.invite-sender').textContent = invite.fromUserName || 'Usuário';
                card.querySelector('.invite-permission').textContent = formatPermission(invite.role);
                const acceptBtn = clone.querySelector('.accept-invite-btn');
                const declineBtn = clone.querySelector('.decline-invite-btn');
                
                if (acceptBtn) acceptBtn.innerHTML = `<i data-lucide="check" class="h-4 w-4"></i><span class="text-sm font-medium">Aceitar</span>`;
                if (declineBtn) declineBtn.innerHTML = `<i data-lucide="x" class="h-4 w-4"></i><span class="text-sm font-medium">Recusar</span>`;
            }
            card.querySelector('.invite-date').textContent = formatDate(invite.createdAt);
            container.appendChild(clone);
        });
    }
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Verifica se há convites pendentes para o usuário atual
 * @returns {Promise<number>} Número de convites pendentes
 */
export async function checkPendingInvitations() {
    const userEmail = getUsuarioEmail()?.toLowerCase();
    if (!userEmail) return 0;
    
    try {
        const query = db.collection('invitations').where('toEmail', '==', userEmail).where('status', '==', 'pending');
        const snapshot = await query.get();
        const pendingCount = snapshot.size;
        updateReceivedInvitesBadge(pendingCount);
        return pendingCount;
    } catch (error) {
        console.error('Erro ao verificar convites pendentes:', error);
        return 0;
    }
}

/**
 * Atualiza o badge de notificação na aba de convites recebidos
 * @param {number} count - Número de convites pendentes
 */
function updateReceivedInvitesBadge(count) {
    [document.getElementById('received-invites-badge'), document.getElementById('menu-invites-badge')].forEach(badge => {
        if (badge) {
            badge.classList.toggle('hidden', count === 0);
            if (count > 0) badge.textContent = count > 9 ? '9+' : count.toString();
        }
    });
}

/**
 * Carrega e exibe os acessos compartilhados
 */
async function loadSharedAccess() {
    const userId = getUsuarioId();
    if (!userId) return;
    
    showLoading('Carregando usuários com acesso...');
    
    try {
        const query = db.collection('invitations').where('fromUserId', '==', userId).where('status', '==', 'accepted');
        const snapshot = await query.get();
        
        let sharedAccess = [];
        snapshot.forEach(doc => {
            sharedAccess.push({ id: doc.id, ...doc.data() });
        });
        
        renderSharedAccess(sharedAccess.sort((a, b) => (b.acceptedAt?.seconds || 0) - (a.acceptedAt?.seconds || 0)));
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error("Erro ao carregar acessos compartilhados:", error);
        showError('Erro', 'Ocorreu um erro ao carregar os usuários com acesso.');
    }
}

/**
 * Renderiza os usuários com acesso compartilhado
 * @param {Array} accessList - Lista de usuários com acesso
 */
function renderSharedAccess(accessList) {
    const container = document.getElementById('shared-access-list');
    const emptyContainer = document.getElementById('no-shared-access');
    
    if (!container || !emptyContainer) return;

    container.innerHTML = '';
    container.classList.toggle('hidden', accessList.length === 0);
    emptyContainer.classList.toggle('hidden', accessList.length > 0);

    if (accessList.length > 0) {
        const template = document.getElementById('shared-access-template');
        if (!template) return;

        accessList.forEach(access => {
            const clone = document.importNode(template.content, true);
            const item = clone.querySelector('.shared-access-item');
            item.dataset.inviteId = access.id;
            item.dataset.email = access.toEmail;
            
            item.querySelector('.user-email').textContent = access.toEmail;
            
            const permissionSelect = item.querySelector('.permission-select');
            permissionSelect.value = access.role;
            permissionSelect.addEventListener('change', () => item.querySelector('.save-permission-btn').classList.remove('hidden'));
            
            container.appendChild(clone);
        });
    }
    if (window.lucide) window.lucide.createIcons();
}

// Funções auxiliares
function getStatusBadgeInfo(status) {
    const statuses = {
        pending: { badgeClass: 'bg-yellow-100 text-yellow-800', statusText: 'Pendente' },
        accepted: { badgeClass: 'bg-green-100 text-green-800', statusText: 'Aceito' },
        declined: { badgeClass: 'bg-red-100 text-red-800', statusText: 'Recusado' },
        canceled: { badgeClass: 'bg-slate-100 text-slate-800', statusText: 'Cancelado' },
        revoked: { badgeClass: 'bg-slate-100 text-slate-800', statusText: 'Revogado' }
    };
    return statuses[status] || { badgeClass: 'bg-slate-100 text-slate-800', statusText: 'Desconhecido' };
}

function formatPermission(role) {
    const roles = { admin: 'Administrador', editor: 'Editor', viewer: 'Leitor' };
    return roles[role] || role;
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'Data desconhecida';
    const date = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return `Hoje, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Ontem, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
    }
}
