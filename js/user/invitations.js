/**
 * Módulo de gerenciamento de convites
 * Versão Corrigida e Final
 */

import { getUsuarioAtual, getUsuarioId, getUsuarioNome, getUsuarioEmail } from '../autenticacao.js';
import { showSuccess, showError, showLoading, hideLoading } from '../ui.js';
import { getUserProfileData } from './userProfile.js';

let db;
let activeTab = 'sent';

export function initInvitations(database) {
    console.log('Inicializando módulo de convites (Versão Corrigida)...');
    db = database;
    setupInviteModal();
    setupManageInvitesModal();
}

function setupInviteModal() {
    const inviteModal = document.getElementById('invite-modal');
    const inviteUserButton = document.getElementById('invite-user-button');
    const closeInviteModal = document.getElementById('close-invite-modal');
    const cancelInviteButton = document.getElementById('cancel-invite-button');
    const sendInviteButton = document.getElementById('send-invite-button');
    
    if (!inviteUserButton || !inviteModal) return;

    inviteUserButton.addEventListener('click', () => {
        // CORRIGIDO: Aponta para o menu de engrenagem
        const settingsDropdown = document.getElementById('settings-menu-dropdown');
        if (settingsDropdown) settingsDropdown.classList.add('hidden');

        inviteModal.classList.remove('hidden');
        setTimeout(() => {
            inviteModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);
        document.getElementById('invite-email-input').value = '';
    });
    
    const closeModal = () => {
        inviteModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
        setTimeout(() => inviteModal.classList.add('hidden'), 300);
    };
    
    closeInviteModal.addEventListener('click', closeModal);
    cancelInviteButton.addEventListener('click', closeModal);
    sendInviteButton.addEventListener('click', sendInvite); // sendInvite from original code
}

function setupManageInvitesModal() {
    const manageInvitesModal = document.getElementById('manage-invites-modal');
    const manageInvitesButton = document.getElementById('manage-invites-button');
    const closeManageInvitesModal = document.getElementById('close-manage-invites-modal');
    const tabInvitesSent = document.getElementById('tab-invites-sent');
    const tabInvitesReceived = document.getElementById('tab-invites-received');
    const tabInvitesAccess = document.getElementById('tab-invites-access');

    if (!manageInvitesButton || !manageInvitesModal) return;

    manageInvitesButton.addEventListener('click', async () => {
        // CORRIGIDO: Aponta para o menu de engrenagem
        const settingsDropdown = document.getElementById('settings-menu-dropdown');
        if (settingsDropdown) settingsDropdown.classList.add('hidden');

        manageInvitesModal.classList.remove('hidden');
        setTimeout(() => {
            manageInvitesModal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
        }, 10);

        const pendingCount = await checkPendingInvitations(); // checkPendingInvitations from original
        if (pendingCount > 0 && activeTab !== 'received') {
            activeTab = 'received';
            updateInvitesTabUI(); // updateInvitesTabUI from original
        }

        if (activeTab === 'access') {
            loadSharedAccess(); // loadSharedAccess from original
        } else {
            loadInvites(activeTab); // loadInvites from original
        }
    });

    closeManageInvitesModal.addEventListener('click', () => {
        manageInvitesModal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
        setTimeout(() => manageInvitesModal.classList.add('hidden'), 300);
    });

    tabInvitesSent.addEventListener('click', () => {
        if (activeTab === 'sent') return;
        activeTab = 'sent';
        updateInvitesTabUI(); // from original
        loadInvites('sent');  // from original
    });

    tabInvitesReceived.addEventListener('click', () => {
        if (activeTab === 'received') return;
        activeTab = 'received';
        updateInvitesTabUI(); // from original
        loadInvites('received'); // from original
    });

    tabInvitesAccess.addEventListener('click', () => {
        if (activeTab === 'access') return;
        activeTab = 'access';
        updateInvitesTabUI(); // from original
        loadSharedAccess();   // from original
    });

    manageInvitesModal.addEventListener('click', async (event) => {
        const target = event.target;
        const card = target.closest('.invite-card, .shared-access-item');
        if (!card) return;

        const inviteId = card.dataset.inviteId;

        if (target.closest('.cancel-invite-btn')) await manageInvite(inviteId, 'cancel'); // new manageInvite
        if (target.closest('.accept-invite-btn')) await manageInvite(inviteId, 'accept'); // new manageInvite
        if (target.closest('.decline-invite-btn')) await manageInvite(inviteId, 'decline'); // new manageInvite

        if (target.closest('.save-permission-btn')) {
            const newRole = card.querySelector('.permission-select').value;
            await updateUserPermission(inviteId, newRole); // new updateUserPermission
            target.closest('.save-permission-btn').classList.add('hidden');
        }

        if (target.closest('.remove-access-btn')) {
            const email = card.dataset.email;
            const { isConfirmed } = await Swal.fire({ // Swal is external, assumed to be available
                title: 'Remover acesso?',
                text: `Tem a certeza que deseja remover o acesso de ${email}?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, remover',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#d33'
            });
            if (isConfirmed) await manageInvite(inviteId, 'revoke'); // new manageInvite
        }
    });
}

/**
 * ATUALIZADA E CORRIGIDA: Ação de 'revoke' não toca mais em 'accessControl'.
 */
async function manageInvite(inviteId, action) {
    showLoading('Processando...');
    try {
        const inviteRef = db.doc(`invitations/${inviteId}`);
        const inviteSnapshot = await inviteRef.get();
        if (!inviteSnapshot.exists) throw new Error("Convite não encontrado.");

        let updatePayload = {};

        if (action === 'accept') {
            updatePayload = {
                status: 'accepted',
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
                toUserId: getUsuarioId()
            };
            // Seu Cloud Function observará essa mudança e criará a permissão em /accessControl.
        } else if (action === 'revoke') {
            // CORRIGIDO: O front-end APENAS sinaliza a revogação.
            // Seu Cloud Function observará essa mudança e removerá a permissão em /accessControl.
            updatePayload = { status: 'revoked' };
        } else {
            updatePayload = { status: action === 'decline' ? 'declined' : 'canceled' };
        }

        await inviteRef.update(updatePayload);

        hideLoading();
        showSuccess('Sucesso!', 'A operação foi concluída.');

        if (activeTab === 'access') loadSharedAccess(); // from original
        else loadInvites(activeTab); // from original
        if (action === 'accept' || action === 'decline') checkPendingInvitations(); // from original

    } catch (error) {
        console.error(`Erro ao executar a ação '${action}':`, error);
        hideLoading();
        showError('Erro', `Ocorreu um erro ao processar o convite: ${error.message}`);
    }
}

/**
 * ATUALIZADA E CORRIGIDA: Não toca mais em 'accessControl'.
 */
async function updateUserPermission(inviteId, newRole) {
    showLoading('Atualizando permissão...');
    try {
        const inviteRef = db.doc(`invitations/${inviteId}`);
        const inviteDoc = await inviteRef.get();
        if (!inviteDoc.exists) throw new Error("Convite não encontrado.");

        const inviteData = inviteDoc.data();
        if (inviteData.fromUserId !== getUsuarioId()) throw new Error("Apenas o dono do convite pode alterar a permissão.");
        if (inviteData.status !== 'accepted') throw new Error("Só é possível alterar permissões de convites já aceitos.");

        // CORRIGIDO: O front-end APENAS atualiza a 'role' no convite.
        // Seu Cloud Function observará essa mudança e atualizará o /accessControl.
        await inviteRef.update({ role: newRole });

        hideLoading();
        showSuccess('Permissão atualizada!');
        loadSharedAccess(); // from original

    } catch (error) {
        console.error('Erro ao atualizar permissão:', error);
        hideLoading();
        showError('Erro na Atualização', error.message);
    }
}

// Funções preservadas do arquivo original:
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
        const isTabActive = key === activeTab;
        tabs[key].classList.toggle('border-indigo-600', isTabActive);
        tabs[key].classList.toggle('text-indigo-600', isTabActive);
        tabs[key].classList.toggle('border-slate-200', !isTabActive);
        tabs[key].classList.toggle('text-slate-500', !isTabActive);
        containers[key].classList.toggle('hidden', !isTabActive);
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function sendInvite() {
    const emailInput = document.getElementById('invite-email-input');
    const permissionSelect = document.getElementById('permission-select'); // Note: This ID is general. Ensure it's the correct one from invite-modal.
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
        // Ensure invite-modal is correctly closed. The new setupInviteModal has a closeModal function.
        // Calling it directly might be better if the context is right, or use the ID.
        document.getElementById('invite-modal').classList.add('hidden');
        hideLoading();
        showSuccess('Convite enviado', `Um convite foi enviado para ${email}.`);
        if (activeTab === 'sent') {
            loadInvites('sent');
        }

    } catch (error) {
        console.error('Erro ao enviar convite:', error);
        hideLoading();
        showError('Erro no Envio', 'Ocorreu um erro ao criar o convite.');
    }
}

async function loadInvites(type) {
    const userId = getUsuarioId();
    const userEmail = getUsuarioEmail()?.toLowerCase();
    if (!userId || !userEmail) return;
    
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
        
        renderInvites(invites.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()), type); // Ensure createdAt is comparable, toMillis() if it's a Firestore Timestamp
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erro', `Ocorreu um erro ao carregar os convites.`);
        console.error(`Error loading ${type} invites:`, error);
    }
}

function renderInvites(invites, type) {
    const containerId = `${type}-invites-list`;
    const emptyId = `no-${type}-invites`;
    const container = document.getElementById(containerId);
    const emptyContainer = document.getElementById(emptyId);
    
    container.innerHTML = ''; // Clear previous items

    if (!container || !emptyContainer) {
        console.error(`Containers for ${type} invites not found.`);
        return;
    }

    container.classList.toggle('hidden', invites.length === 0);
    emptyContainer.classList.toggle('hidden', invites.length > 0);

    if(invites.length > 0) {
        const templateId = type === 'sent' ? 'sent-invite-template' : 'received-invite-template';
        const template = document.getElementById(templateId);
        if (!template) {
            console.error(`Template ${templateId} not found.`);
            return;
        }

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
                // Show/hide cancel button based on status
                const cancelContainer = card.querySelector('.cancel-invite-container');
                if (cancelContainer) {
                   cancelContainer.style.display = invite.status === 'pending' ? '' : 'none';
                }
            } else { // received
                card.querySelector('.invite-sender').textContent = invite.fromUserName || 'Usuário';
                card.querySelector('.invite-permission').textContent = formatPermission(invite.role);
                const acceptBtn = clone.querySelector('.accept-invite-btn');
                const declineBtn = clone.querySelector('.decline-invite-btn');
                
                if (acceptBtn) acceptBtn.innerHTML = `<i data-lucide="check" class="h-4 w-4"></i><span class="text-sm font-medium">Aceitar</span>`;
                if (declineBtn) declineBtn.innerHTML = `<i data-lucide="x" class="h-4 w-4"></i><span class="text-sm font-medium">Recusar</span>`;
            }
            card.querySelector('.invite-date').textContent = formatDate(invite.createdAt); // createdAt needs to be a Date object or timestamp
            container.appendChild(clone);
        });
    }
    if (window.lucide) window.lucide.createIcons();
}

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

function updateReceivedInvitesBadge(count) {
    [document.getElementById('received-invites-badge'), document.getElementById('menu-invites-badge')].forEach(badge => {
        if (badge) {
            badge.classList.toggle('hidden', count === 0);
            if (count > 0) badge.textContent = count > 9 ? '9+' : count.toString();
        }
    });
}

async function loadSharedAccess() {
    const userId = getUsuarioId();
    if (!userId) return;
    
    showLoading('Carregando usuários com acesso...');
    
    try {
        // Query for invitations initiated by the current user that have been accepted
        const query = db.collection('invitations')
                        .where('fromUserId', '==', userId)
                        .where('status', '==', 'accepted');
        const snapshot = await query.get();
        
        let sharedAccess = [];
        snapshot.forEach(doc => {
            sharedAccess.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by acceptedAt, most recent first. Handle cases where acceptedAt might be missing.
        renderSharedAccess(sharedAccess.sort((a, b) => {
            const timeA = a.acceptedAt ? a.acceptedAt.toMillis() : 0;
            const timeB = b.acceptedAt ? b.acceptedAt.toMillis() : 0;
            return timeB - timeA;
        }));
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erro', 'Ocorreu um erro ao carregar os usuários com acesso.');
        console.error('Error loading shared access:', error);
    }
}

function renderSharedAccess(accessList) {
    const container = document.getElementById('shared-access-list');
    const emptyContainer = document.getElementById('no-shared-access');
    
    container.innerHTML = ''; // Clear previous items

    if (!container || !emptyContainer) {
        console.error("Containers for shared access list not found.");
        return;
    }

    container.classList.toggle('hidden', accessList.length === 0);
    emptyContainer.classList.toggle('hidden', accessList.length > 0);

    if (accessList.length > 0) {
        const template = document.getElementById('shared-access-template');
        if (!template) {
            console.error("Template shared-access-template not found.");
            return;
        }
        accessList.forEach(access => {
            const clone = document.importNode(template.content, true);
            const item = clone.querySelector('.shared-access-item');
            item.dataset.inviteId = access.id; // This is the invitation ID
            item.dataset.email = access.toEmail; // Keep track of the email for display or other uses
            
            item.querySelector('.user-email').textContent = access.toEmail;
            
            const permissionSelect = item.querySelector('.permission-select');
            permissionSelect.value = access.role; // Set current role

            const saveButton = item.querySelector('.save-permission-btn');
            saveButton.classList.add('hidden'); // Hide save button initially
            permissionSelect.addEventListener('change', () => saveButton.classList.remove('hidden'));
            
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
    if (!timestamp) return 'Data desconhecida';
    // Assuming timestamp is a Firestore Timestamp object
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
    }
}
