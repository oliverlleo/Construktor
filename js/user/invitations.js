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
 * @param {Object} database - Referência ao banco de dados Firebase
 */
export function initInvitations(database) {
    console.log('Inicializando módulo de convites...');
    db = database;
    
    setupInviteModal();
    setupManageInvitesModal();
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
    
    // Abrir o modal
    inviteUserButton.addEventListener('click', () => {
        document.getElementById('user-menu-dropdown').classList.add('hidden');
        inviteModal.classList.remove('hidden');
        setTimeout(() => {
            inviteModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        // Limpa o campo de email
        document.getElementById('invite-email-input').value = '';
    });
    
    // Fechar o modal
    const closeModal = () => {
        inviteModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
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
    
    // Abrir o modal
    manageInvitesButton.addEventListener('click', () => {
        document.getElementById('user-menu-dropdown').classList.add('hidden');
        manageInvitesModal.classList.remove('hidden');
        setTimeout(() => {
            manageInvitesModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        // Carrega os convites
        loadInvites(activeTab);
    });
    
    // Fechar o modal
    closeManageInvitesModal.addEventListener('click', () => {
        manageInvitesModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
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
    
    // Delegação de eventos para os convites
    manageInvitesModal.addEventListener('click', async (event) => {
        // Cancelar convite enviado
        const cancelBtn = event.target.closest('.cancel-invite-btn');
        if (cancelBtn) {
            const inviteCard = cancelBtn.closest('.invite-card');
            const inviteId = inviteCard.dataset.inviteId;
            await cancelInvite(inviteId);
            return;
        }
        
        // Aceitar convite recebido
        const acceptBtn = event.target.closest('.accept-invite-btn');
        if (acceptBtn) {
            const inviteCard = acceptBtn.closest('.invite-card');
            const inviteId = inviteCard.dataset.inviteId;
            await acceptInvite(inviteId);
            return;
        }
        
        // Recusar convite recebido
        const declineBtn = event.target.closest('.decline-invite-btn');
        if (declineBtn) {
            const inviteCard = declineBtn.closest('.invite-card');
            const inviteId = inviteCard.dataset.inviteId;
            await declineInvite(inviteId);
            return;
        }
    });
}

/**
 * Atualiza a UI das abas de convites
 */
function updateInvitesTabUI() {
    const tabSent = document.getElementById('tab-invites-sent');
    const tabReceived = document.getElementById('tab-invites-received');
    const sentContainer = document.getElementById('sent-invites-container');
    const receivedContainer = document.getElementById('received-invites-container');
    
    if (activeTab === 'sent') {
        tabSent.classList.remove('border-slate-200', 'text-slate-500');
        tabSent.classList.add('border-indigo-600', 'text-indigo-600');
        
        tabReceived.classList.remove('border-indigo-600', 'text-indigo-600');
        tabReceived.classList.add('border-slate-200', 'text-slate-500');
        
        sentContainer.classList.remove('hidden');
        receivedContainer.classList.add('hidden');
    } else {
        tabReceived.classList.remove('border-slate-200', 'text-slate-500');
        tabReceived.classList.add('border-indigo-600', 'text-indigo-600');
        
        tabSent.classList.remove('border-indigo-600', 'text-indigo-600');
        tabSent.classList.add('border-slate-200', 'text-slate-500');
        
        receivedContainer.classList.remove('hidden');
        sentContainer.classList.add('hidden');
    }
}

/**
 * Envia um convite para outro usuário
 */
async function sendInvite() {
    const emailInput = document.getElementById('invite-email-input');
    const permissionSelect = document.getElementById('permission-select');
    
    const email = emailInput.value.trim().toLowerCase();
    const permission = permissionSelect.value;
    
    if (!email) {
        showError('Erro', 'Por favor, informe o email do usuário.');
        return;
    }
    
    // Verifica se é um email válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Erro', 'Por favor, informe um email válido.');
        return;
    }
    
    // Não permite convidar a si mesmo
    if (email === getUsuarioEmail()?.toLowerCase()) {
        showError('Erro', 'Você não pode convidar a si mesmo.');
        return;
    }
    
    showLoading('Enviando convite...');
    
    try {
        const currentUser = getUsuarioAtual();
        const userId = getUsuarioId();
        
        if (!currentUser || !userId) {
            throw new Error('Usuário não autenticado.');
        }
        
        // Busca o perfil do usuário atual
        const userProfile = await getUserProfileData() || {};
        const senderName = userProfile.displayName || getUsuarioNome() || getUsuarioEmail() || 'Usuário';
        
        // Cria um novo convite
        const inviteRef = db.ref('invitations').push();
        
        await inviteRef.set({
            fromUserId: userId,
            fromUserName: senderName,
            toEmail: email,
            resourceType: 'module_constructor', // Tipo de recurso compartilhado
            resourceId: 'main_constructor',     // ID do recurso (neste caso, o construtor principal)
            role: permission,                   // Permissão concedida
            status: 'pending',                  // Status inicial: pendente
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Fecha o modal
        const inviteModal = document.getElementById('invite-modal');
        inviteModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            inviteModal.classList.add('hidden');
        }, 300);
        
        hideLoading();
        showSuccess('Convite enviado', `Um convite foi enviado para ${email}.`);
    } catch (error) {
        console.error('Erro ao enviar convite:', error);
        hideLoading();
        showError('Erro', 'Ocorreu um erro ao enviar o convite.');
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
        showError('Erro', 'Usuário não autenticado.');
        return;
    }
    
    showLoading(`Carregando convites ${type === 'sent' ? 'enviados' : 'recebidos'}...`);
    
    try {
        let query;
        
        if (type === 'sent') {
            // Busca convites enviados pelo usuário atual
            query = db.ref('invitations').orderByChild('fromUserId').equalTo(userId);
        } else {
            // Busca convites recebidos pelo email do usuário atual
            query = db.ref('invitations').orderByChild('toEmail').equalTo(userEmail);
        }
        
        const snapshot = await query.once('value');
        const invites = [];
        
        snapshot.forEach(childSnapshot => {
            const invite = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            
            // Filtra apenas convites recebidos com status 'pending'
            if (type === 'received' && invite.status !== 'pending') {
                return;
            }
            
            invites.push(invite);
        });
        
        renderInvites(invites, type);
        hideLoading();
    } catch (error) {
        console.error(`Erro ao carregar convites ${type}:`, error);
        hideLoading();
        showError('Erro', `Ocorreu um erro ao carregar os convites ${type === 'sent' ? 'enviados' : 'recebidos'}.`);
    }
}

/**
 * Renderiza os convites na interface
 * @param {Array} invites - Lista de convites
 * @param {string} type - Tipo de convites: 'sent' ou 'received'
 */
function renderInvites(invites, type) {
    const container = document.getElementById(`${type}-invites-list`);
    const emptyContainer = document.getElementById(`no-${type}-invites`);
    
    container.innerHTML = '';
    
    if (invites.length === 0) {
        container.classList.add('hidden');
        emptyContainer.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyContainer.classList.add('hidden');
    
    invites.forEach(invite => {
        if (type === 'sent') {
            renderSentInvite(invite, container);
        } else {
            renderReceivedInvite(invite, container);
        }
    });
    
    // Atualiza os ícones
    const iconsToUpdate = document.querySelectorAll('[data-lucide]');
    if (window.lucide && iconsToUpdate) {
        lucide.createIcons({
            icons: iconsToUpdate
        });
    }
}

/**
 * Renderiza um convite enviado
 * @param {Object} invite - Dados do convite
 * @param {HTMLElement} container - Elemento container onde o convite será renderizado
 */
function renderSentInvite(invite, container) {
    const template = document.getElementById('sent-invite-template');
    const clone = document.importNode(template.content, true);
    
    const inviteCard = clone.querySelector('.invite-card');
    inviteCard.dataset.inviteId = invite.id;
    
    const emailEl = clone.querySelector('.invite-email');
    emailEl.textContent = invite.toEmail;
    
    const dateEl = clone.querySelector('.invite-date');
    dateEl.textContent = formatDate(invite.createdAt);
    
    const statusBadge = clone.querySelector('.invite-status-badge');
    const { badgeClass, statusText } = getStatusBadgeInfo(invite.status);
    statusBadge.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`;
    statusBadge.textContent = statusText;
    
    // O botão de cancelar só aparece se o status for 'pending'
    const cancelBtn = clone.querySelector('.cancel-invite-btn');
    if (invite.status !== 'pending') {
        cancelBtn.style.display = 'none';
    }
    
    container.appendChild(clone);
}

/**
 * Renderiza um convite recebido
 * @param {Object} invite - Dados do convite
 * @param {HTMLElement} container - Elemento container onde o convite será renderizado
 */
function renderReceivedInvite(invite, container) {
    const template = document.getElementById('received-invite-template');
    const clone = document.importNode(template.content, true);
    
    const inviteCard = clone.querySelector('.invite-card');
    inviteCard.dataset.inviteId = invite.id;
    
    const senderEl = clone.querySelector('.invite-sender');
    senderEl.textContent = invite.fromUserName || 'Usuário';
    
    const dateEl = clone.querySelector('.invite-date');
    dateEl.textContent = formatDate(invite.createdAt);
    
    const permissionEl = clone.querySelector('.invite-permission');
    permissionEl.textContent = formatPermission(invite.role);
    
    container.appendChild(clone);
}

/**
 * Cancela um convite enviado
 * @param {string} inviteId - ID do convite
 */
async function cancelInvite(inviteId) {
    const userId = getUsuarioId();
    
    if (!userId) {
        showError('Erro', 'Usuário não autenticado.');
        return;
    }
    
    try {
        // Verifica se o convite existe e pertence ao usuário atual
        const inviteSnapshot = await db.ref(`invitations/${inviteId}`).once('value');
        const invite = inviteSnapshot.val();
        
        if (!invite || invite.fromUserId !== userId) {
            showError('Erro', 'Convite não encontrado ou não autorizado.');
            return;
        }
        
        // Atualiza o status do convite para 'canceled'
        await db.ref(`invitations/${inviteId}`).update({
            status: 'canceled',
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Atualiza a UI
        const inviteCard = document.querySelector(`.invite-card[data-invite-id="${inviteId}"]`);
        if (inviteCard) {
            const statusBadge = inviteCard.querySelector('.invite-status-badge');
            const { badgeClass, statusText } = getStatusBadgeInfo('canceled');
            statusBadge.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`;
            statusBadge.textContent = statusText;
            
            // Esconde o botão de cancelar
            inviteCard.querySelector('.cancel-invite-btn').style.display = 'none';
        }
        
        showSuccess('Convite cancelado', 'O convite foi cancelado com sucesso.');
    } catch (error) {
        console.error('Erro ao cancelar convite:', error);
        showError('Erro', 'Ocorreu um erro ao cancelar o convite.');
    }
}

/**
 * Aceita um convite recebido
 * @param {string} inviteId - ID do convite
 */
async function acceptInvite(inviteId) {
    const userId = getUsuarioId();
    const userEmail = getUsuarioEmail()?.toLowerCase();
    
    if (!userId || !userEmail) {
        showError('Erro', 'Usuário não autenticado.');
        return;
    }
    
    try {
        // Verifica se o convite existe e é para o usuário atual
        const inviteSnapshot = await db.ref(`invitations/${inviteId}`).once('value');
        const invite = inviteSnapshot.val();
        
        if (!invite || invite.toEmail !== userEmail || invite.status !== 'pending') {
            showError('Erro', 'Convite não encontrado ou não autorizado.');
            return;
        }
        
        // Atualiza o status do convite para 'accepted'
        await db.ref(`invitations/${inviteId}`).update({
            status: 'accepted',
            acceptedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Adiciona uma entrada na tabela de controle de acesso
        await db.ref(`accessControl/${userId}`).update({
            [invite.resourceId]: invite.role,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Remove o convite da lista
        const inviteCard = document.querySelector(`.invite-card[data-invite-id="${inviteId}"]`);
        if (inviteCard) {
            inviteCard.remove();
            
            // Verifica se ainda existem convites
            const receivedList = document.getElementById('received-invites-list');
            if (receivedList.children.length === 0) {
                document.getElementById('no-received-invites').classList.remove('hidden');
                receivedList.classList.add('hidden');
            }
        }
        
        showSuccess('Convite aceito', 'Agora você tem acesso ao recurso compartilhado.');
    } catch (error) {
        console.error('Erro ao aceitar convite:', error);
        showError('Erro', 'Ocorreu um erro ao aceitar o convite.');
    }
}

/**
 * Recusa um convite recebido
 * @param {string} inviteId - ID do convite
 */
async function declineInvite(inviteId) {
    const userEmail = getUsuarioEmail()?.toLowerCase();
    
    if (!userEmail) {
        showError('Erro', 'Usuário não autenticado.');
        return;
    }
    
    try {
        // Verifica se o convite existe e é para o usuário atual
        const inviteSnapshot = await db.ref(`invitations/${inviteId}`).once('value');
        const invite = inviteSnapshot.val();
        
        if (!invite || invite.toEmail !== userEmail || invite.status !== 'pending') {
            showError('Erro', 'Convite não encontrado ou não autorizado.');
            return;
        }
        
        // Atualiza o status do convite para 'declined'
        await db.ref(`invitations/${inviteId}`).update({
            status: 'declined',
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Remove o convite da lista
        const inviteCard = document.querySelector(`.invite-card[data-invite-id="${inviteId}"]`);
        if (inviteCard) {
            inviteCard.remove();
            
            // Verifica se ainda existem convites
            const receivedList = document.getElementById('received-invites-list');
            if (receivedList.children.length === 0) {
                document.getElementById('no-received-invites').classList.remove('hidden');
                receivedList.classList.add('hidden');
            }
        }
        
        showSuccess('Convite recusado', 'O convite foi recusado com sucesso.');
    } catch (error) {
        console.error('Erro ao recusar convite:', error);
        showError('Erro', 'Ocorreu um erro ao recusar o convite.');
    }
}

/**
 * Verifica se há convites pendentes para o usuário atual
 * @returns {Promise<number>} Número de convites pendentes
 */
export async function checkPendingInvitations() {
    const userEmail = getUsuarioEmail()?.toLowerCase();
    
    if (!userEmail) {
        return 0;
    }
    
    try {
        const query = db.ref('invitations')
                        .orderByChild('toEmail')
                        .equalTo(userEmail);
        
        const snapshot = await query.once('value');
        let pendingCount = 0;
        
        snapshot.forEach(childSnapshot => {
            const invite = childSnapshot.val();
            if (invite.status === 'pending') {
                pendingCount++;
            }
        });
        
        return pendingCount;
    } catch (error) {
        console.error('Erro ao verificar convites pendentes:', error);
        return 0;
    }
}

// Funções auxiliares

/**
 * Retorna informações de estilo e texto para o badge de status
 * @param {string} status - Status do convite
 * @returns {Object} Objeto com classe CSS e texto do status
 */
function getStatusBadgeInfo(status) {
    switch (status) {
        case 'pending':
            return { 
                badgeClass: 'bg-yellow-100 text-yellow-800', 
                statusText: 'Pendente' 
            };
        case 'accepted':
            return { 
                badgeClass: 'bg-green-100 text-green-800', 
                statusText: 'Aceito' 
            };
        case 'declined':
            return { 
                badgeClass: 'bg-red-100 text-red-800', 
                statusText: 'Recusado' 
            };
        case 'canceled':
            return { 
                badgeClass: 'bg-slate-100 text-slate-800', 
                statusText: 'Cancelado' 
            };
        default:
            return { 
                badgeClass: 'bg-slate-100 text-slate-800', 
                statusText: 'Desconhecido' 
            };
    }
}

/**
 * Formata a permissão para exibição
 * @param {string} role - Papel/permissão do usuário
 * @returns {string} Permissão formatada
 */
function formatPermission(role) {
    switch (role) {
        case 'admin':
            return 'Administrador';
        case 'editor':
            return 'Editor';
        case 'viewer':
            return 'Leitor';
        default:
            return role || 'Desconhecido';
    }
}

/**
 * Formata uma data timestamp para exibição
 * @param {number} timestamp - Timestamp em milissegundos
 * @returns {string} Data formatada
 */
function formatDate(timestamp) {
    if (!timestamp) return 'Data desconhecida';
    
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
        return `Hoje, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
        return `Ontem, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}