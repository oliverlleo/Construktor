/**
 * Módulo de gerenciamento de convites
 * Responsável por criar, aceitar e recusar convites para usuários
 */

import { getUsuarioAtual, getUsuarioId, getUsuarioNome, getUsuarioEmail } from '../autenticacao.js';
import { showSuccess, showError, showLoading, hideLoading } from '../ui.js';
import { getUserProfileData } from './userProfile.js';
import { loadSharedResources } from '../database.js';

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
    const tabInvitesAccess = document.getElementById('tab-invites-access');
    
    // Abrir o modal
    manageInvitesButton.addEventListener('click', async () => {
        document.getElementById('user-menu-dropdown').classList.add('hidden');
        manageInvitesModal.classList.remove('hidden');
        setTimeout(() => {
            manageInvitesModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        // Verifica se há convites pendentes
        const pendingCount = await checkPendingInvitations();
        
        // Se houver convites pendentes e a aba ativa não for "recebidos", muda para essa aba
        if (pendingCount > 0 && activeTab !== 'received') {
            activeTab = 'received';
            updateInvitesTabUI();
        }
        
        // Carrega os convites ou acessos compartilhados
        if (activeTab === 'access') {
            loadSharedAccess();
        } else {
            loadInvites(activeTab);
        }
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
    
    tabInvitesAccess.addEventListener('click', () => {
        if (activeTab === 'access') return;
        
        activeTab = 'access';
        updateInvitesTabUI();
        loadSharedAccess();
    });
    
    // Delegação de eventos para os convites e acessos
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
        
        // Salvar alteração de permissão
        const savePermissionBtn = event.target.closest('.save-permission-btn');
        if (savePermissionBtn) {
            const accessItem = savePermissionBtn.closest('.shared-access-item');
            const userId = accessItem.dataset.userId;
            const email = accessItem.dataset.email;
            const resourceId = accessItem.dataset.resourceId;
            const permissionSelect = accessItem.querySelector('.permission-select');
            const newRole = permissionSelect.value;
            
            if (userId && resourceId && newRole) {
                await updateUserPermission(userId, resourceId, newRole, email);
                savePermissionBtn.classList.add('hidden');
            }
            return;
        }
        
        // Remover acesso de usuário
        const removeAccessBtn = event.target.closest('.remove-access-btn');
        if (removeAccessBtn) {
            const accessItem = removeAccessBtn.closest('.shared-access-item');
            const userId = accessItem.dataset.userId;
            const email = accessItem.dataset.email;
            
            if (userId && email) {
                const confirmRemove = await Swal.fire({
                    title: 'Remover acesso',
                    text: `Tem certeza que deseja remover o acesso de ${email}?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, remover',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6'
                });
                
                if (confirmRemove.isConfirmed) {
                    await removeUserAccess(userId);
                }
            }
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
    const tabAccess = document.getElementById('tab-invites-access');
    const sentContainer = document.getElementById('sent-invites-container');
    const receivedContainer = document.getElementById('received-invites-container');
    const accessContainer = document.getElementById('access-management-container');
    
    // Primeiro, resetamos todos os estilos e ocultamos todos os containers
    [tabSent, tabReceived, tabAccess].forEach(tab => {
        tab.classList.remove('border-indigo-600', 'text-indigo-600');
        tab.classList.add('border-slate-200', 'text-slate-500');
    });
    
    [sentContainer, receivedContainer, accessContainer].forEach(container => {
        container.classList.add('hidden');
    });
    
    // Depois, configuramos a aba ativa
    if (activeTab === 'sent') {
        tabSent.classList.remove('border-slate-200', 'text-slate-500');
        tabSent.classList.add('border-indigo-600', 'text-indigo-600');
        sentContainer.classList.remove('hidden');
    } else if (activeTab === 'received') {
        tabReceived.classList.remove('border-slate-200', 'text-slate-500');
        tabReceived.classList.add('border-indigo-600', 'text-indigo-600');
        receivedContainer.classList.remove('hidden');
    } else if (activeTab === 'access') {
        tabAccess.classList.remove('border-slate-200', 'text-slate-500');
        tabAccess.classList.add('border-indigo-600', 'text-indigo-600');
        accessContainer.classList.remove('hidden');
    }
    
    // Atualiza os ícones para garantir que eles sejam renderizados corretamente
    if (window.lucide) {
        window.lucide.createIcons();
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
        
        // Obtém a área de trabalho atual para compartilhar
        const currentWorkspace = window.getCurrentWorkspace ? window.getCurrentWorkspace() : null;
        if (!currentWorkspace) {
            hideLoading();
            showError('Erro', 'Nenhuma área de trabalho selecionada para compartilhar.');
            return;
        }
        
        // Cria um novo convite
        const inviteRef = db.ref('invitations').push();
        
        await inviteRef.set({
            fromUserId: userId,
            fromUserName: senderName,
            toEmail: email,
            resourceType: 'workspace',          // Tipo de recurso compartilhado
            resourceId: currentWorkspace.id,    // ID da área de trabalho
            resourceName: currentWorkspace.name, // Nome da área de trabalho
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
    const cancelContainer = clone.querySelector('.cancel-invite-container');
    if (invite.status !== 'pending') {
        cancelContainer.style.display = 'none';
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
    
    // Adiciona texto aos botões para melhorar a usabilidade
    const acceptBtn = clone.querySelector('.accept-invite-btn');
    const declineBtn = clone.querySelector('.decline-invite-btn');
    
    // Adiciona texto ao botão de aceitar e ajusta a aparência
    acceptBtn.classList.remove('p-1');
    acceptBtn.classList.add('px-3', 'py-1.5', 'flex', 'items-center', 'gap-1', 'rounded-md', 'bg-emerald-50');
    acceptBtn.innerHTML = `
        <i data-lucide="check" class="h-4 w-4"></i>
        <span class="text-sm font-medium">Aceitar</span>
    `;
    
    // Adiciona texto ao botão de recusar e ajusta a aparência
    declineBtn.classList.remove('p-1');
    declineBtn.classList.add('px-3', 'py-1.5', 'flex', 'items-center', 'gap-1', 'rounded-md', 'bg-slate-50');
    declineBtn.innerHTML = `
        <i data-lucide="x" class="h-4 w-4"></i>
        <span class="text-sm font-medium">Recusar</span>
    `;
    
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
        showLoading('Cancelando convite...');
        
        // Verifica se o convite existe e pertence ao usuário atual
        const inviteSnapshot = await db.ref(`invitations/${inviteId}`).once('value');
        const invite = inviteSnapshot.val();
        
        if (!invite || invite.fromUserId !== userId) {
            hideLoading();
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
            
            // Esconde o container do botão de cancelar
            const cancelContainer = inviteCard.querySelector('.cancel-invite-container');
            if (cancelContainer) {
                cancelContainer.style.display = 'none';
            }
        }
        
        hideLoading();
        showSuccess('Convite cancelado', 'O convite foi cancelado com sucesso.');
    } catch (error) {
        hideLoading();
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
        
        // Atualiza a lista de áreas de trabalho compartilhadas
        import('../workspaces.js').then(module => {
            console.log("Atualizando workspaces após aceitar convite...");
            module.refreshWorkspaces();
            
            // Recarrega explicitamente para garantir que os dados sejam atualizados
            setTimeout(() => {
                console.log("Recarregando workspaces compartilhados após delay...");
                module.loadSharedWorkspaces();
            }, 1500);
        });
        
        // Fecha o modal após alguns segundos
        setTimeout(() => {
            const manageInvitesModal = document.getElementById('manage-invites-modal');
            if (manageInvitesModal && !manageInvitesModal.classList.contains('hidden')) {
                manageInvitesModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    manageInvitesModal.classList.add('hidden');
                }, 300);
            }
        }, 2000);
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
        
        // Atualiza o badge de notificação na aba de convites recebidos
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
    // Atualiza o badge na aba dentro do modal
    const tabBadge = document.getElementById('received-invites-badge');
    if (tabBadge) {
        if (count > 0) {
            tabBadge.textContent = count > 9 ? '9+' : count.toString();
            tabBadge.classList.remove('hidden');
        } else {
            tabBadge.classList.add('hidden');
        }
    }
    
    // Atualiza o badge no menu principal
    const menuBadge = document.getElementById('menu-invites-badge');
    if (menuBadge) {
        if (count > 0) {
            menuBadge.textContent = count > 9 ? '9+' : count.toString();
            menuBadge.classList.remove('hidden');
        } else {
            menuBadge.classList.add('hidden');
        }
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
 * Carrega e exibe os acessos compartilhados
 */
async function loadSharedAccess() {
    const userId = getUsuarioId();
    
    if (!userId) {
        showError('Erro', 'Usuário não autenticado.');
        return;
    }
    
    showLoading('Carregando usuários com acesso...');
    
    try {
        // Busca todos os convites aceitos que o usuário enviou
        const query = db.ref('invitations')
            .orderByChild('fromUserId')
            .equalTo(userId);
        
        const snapshot = await query.once('value');
        const sharedAccess = [];
        
        snapshot.forEach(childSnapshot => {
            const invite = childSnapshot.val();
            // Considera apenas convites aceitos
            if (invite.status === 'accepted') {
                sharedAccess.push({
                    id: childSnapshot.key,
                    userId: invite.toUserId,
                    email: invite.toEmail,
                    resourceId: invite.resourceId,
                    resourceType: invite.resourceType,
                    role: invite.role,
                    acceptedAt: invite.acceptedAt
                });
            }
        });
        
        // Renderiza os usuários com acesso
        renderSharedAccess(sharedAccess);
        hideLoading();
    } catch (error) {
        console.error('Erro ao carregar usuários com acesso:', error);
        hideLoading();
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
    
    container.innerHTML = '';
    
    if (accessList.length === 0) {
        container.classList.add('hidden');
        emptyContainer.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyContainer.classList.add('hidden');
    
    // Ordena pela data de aceitação, mais recente primeiro
    accessList.sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
    
    accessList.forEach(access => {
        renderSharedAccessItem(access, container);
    });
    
    // Atualiza os ícones Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Renderiza um item de acesso compartilhado
 * @param {Object} access - Dados do acesso
 * @param {HTMLElement} container - Container onde o item será renderizado
 */
function renderSharedAccessItem(access, container) {
    const template = document.getElementById('shared-access-template');
    const clone = document.importNode(template.content, true);
    
    const accessItem = clone.querySelector('.shared-access-item');
    accessItem.dataset.userId = access.userId || '';
    accessItem.dataset.email = access.email || '';
    accessItem.dataset.resourceId = access.resourceId || '';
    accessItem.dataset.role = access.role || '';
    
    const emailEl = clone.querySelector('.user-email');
    emailEl.textContent = access.email || 'Email desconhecido';
    
    const permissionSelect = clone.querySelector('.permission-select');
    permissionSelect.value = access.role || 'viewer';
    
    // Adiciona eventos para o dropdown de permissão
    permissionSelect.addEventListener('change', function() {
        const saveBtn = accessItem.querySelector('.save-permission-btn');
        saveBtn.classList.remove('hidden');
    });
    
    container.appendChild(clone);
}

/**
 * Atualiza a permissão de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} resourceId - ID do recurso
 * @param {string} newRole - Nova permissão
 * @param {string} email - Email do usuário
 */
async function updateUserPermission(userId, resourceId, newRole, email) {
    if (!userId || !resourceId || !newRole) {
        showError('Erro', 'Dados inválidos para atualizar permissão.');
        return;
    }
    
    showLoading('Atualizando permissão...');
    
    try {
        const currentUserId = getUsuarioId();
        
        // Busca o convite aceito correspondente
        const invitesQuery = db.ref('invitations')
            .orderByChild('fromUserId')
            .equalTo(currentUserId);
        
        const snapshot = await invitesQuery.once('value');
        const updates = {};
        let found = false;
        
        snapshot.forEach(childSnapshot => {
            const invite = childSnapshot.val();
            if (invite.status === 'accepted' && 
                invite.toEmail === email && 
                invite.resourceId === resourceId) {
                
                // Atualiza a permissão no convite
                updates[`invitations/${childSnapshot.key}/role`] = newRole;
                updates[`invitations/${childSnapshot.key}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
                
                // Atualiza a permissão no controle de acesso
                updates[`accessControl/${userId}/${resourceId}`] = newRole;
                
                found = true;
            }
        });
        
        if (!found) {
            hideLoading();
            showError('Erro', 'Convite não encontrado para atualizar.');
            return;
        }
        
        // Aplica todas as atualizações
        await db.ref().update(updates);
        
        // Atualiza o dataset do item na UI
        const accessItem = document.querySelector(`.shared-access-item[data-user-id="${userId}"]`);
        if (accessItem) {
            accessItem.dataset.role = newRole;
        }
        
        hideLoading();
        showSuccess('Permissão atualizada', `A permissão de ${email} foi alterada para ${formatPermission(newRole)}.`);
    } catch (error) {
        hideLoading();
        console.error('Erro ao atualizar permissão:', error);
        showError('Erro', 'Ocorreu um erro ao atualizar a permissão.');
    }
}

/**
 * Remove o acesso de um usuário
 * @param {string} userId - ID do usuário a ter o acesso removido
 */
async function removeUserAccess(userId) {
    if (!userId) {
        showError('Erro', 'ID de usuário inválido.');
        return;
    }
    
    showLoading('Removendo acesso...');
    
    try {
        const currentUserId = getUsuarioId();
        
        // Busca todos os convites aceitos para este usuário
        const invitesQuery = db.ref('invitations')
            .orderByChild('fromUserId')
            .equalTo(currentUserId);
        
        const snapshot = await invitesQuery.once('value');
        const updates = {};
        let found = false;
        
        snapshot.forEach(childSnapshot => {
            const invite = childSnapshot.val();
            if (invite.status === 'accepted' && invite.toEmail) {
                // Verifica se é o usuário correto através do email
                const accessItem = document.querySelector(`.shared-access-item[data-user-id="${userId}"]`);
                if (accessItem && accessItem.dataset.email === invite.toEmail) {
                    // Marca o convite como revogado
                    updates[`invitations/${childSnapshot.key}/status`] = 'revoked';
                    updates[`invitations/${childSnapshot.key}/revokedAt`] = firebase.database.ServerValue.TIMESTAMP;
                    
                    // Remove o acesso no controle de acesso
                    if (invite.resourceId) {
                        updates[`accessControl/${userId}/${invite.resourceId}`] = null;
                    }
                    
                    found = true;
                }
            }
        });
        
        if (!found) {
            hideLoading();
            showError('Erro', 'Nenhum acesso encontrado para este usuário.');
            return;
        }
        
        // Aplica todas as atualizações em uma única transação
        await db.ref().update(updates);
        
        // Remove o item da UI
        const accessItem = document.querySelector(`.shared-access-item[data-user-id="${userId}"]`);
        if (accessItem) {
            accessItem.remove();
            
            // Verifica se ainda existem itens
            const accessList = document.getElementById('shared-access-list');
            if (accessList.children.length === 0) {
                document.getElementById('no-shared-access').classList.remove('hidden');
                accessList.classList.add('hidden');
            }
        }
        
        hideLoading();
        showSuccess('Acesso removido', 'O acesso do usuário foi removido com sucesso.');
    } catch (error) {
        hideLoading();
        console.error('Erro ao remover acesso:', error);
        showError('Erro', 'Ocorreu um erro ao remover o acesso do usuário.');
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