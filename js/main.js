/**
 * Arquivo principal do Construktor
 * Coordena a inicialização dos módulos e a interação entre eles
 */

import { firebaseConfig, availableEntityIcons, fieldTypes } from './config.js';
import { initAutenticacao, isUsuarioLogado, getUsuarioId } from './autenticacao.js';
import { initDatabase, loadAllEntities, loadAndRenderModules, loadDroppedEntitiesIntoModules, 
         loadStructureForEntity, createEntity, createModule, saveEntityToModule, deleteEntityFromModule,
         deleteEntity, deleteModule, saveEntityStructure, saveSubEntityStructure, saveModulesOrder } from './database.js';
import { initUI, createIcons, checkEmptyStates, showLoading, hideLoading, showSuccess, 
         showError, showConfirmDialog, showInputDialog } from './ui.js';

// Variáveis globais
let db;
let modalNavigationStack = [];

// ==== PONTO DE ENTRADA DA APLICAÇÃO ====
async function initApp() {
    showLoading('Inicializando aplicação...');
    
    try {
        // Inicializa o Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Inicializa os módulos
        await initAutenticacao();
        
        // Verifica se o usuário está autenticado
        if (!isUsuarioLogado()) {
            // Não precisa mostrar erro aqui pois o módulo de autenticação
            // já vai redirecionar para a página de login
            hideLoading();
            return;
        }
        
        // Inicializa o banco de dados
        await initDatabase(firebase);
        db = firebase.database();
        
        // Inicializa a interface do usuário
        initUI();
        
        // Carrega os dados iniciais
        await loadAllEntities();
        await loadAndRenderModules(renderModule);
        await loadDroppedEntitiesIntoModules(renderDroppedEntity);
        
        // Popula a caixa de ferramentas
        populateFieldsToolbox();
        
        // Configura os event listeners
        setupEventListeners();
        
        // Verifica os estados vazios
        checkEmptyStates();
        
        hideLoading();
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    } catch (error) {
        console.error("Erro ao inicializar aplicação:", error);
        document.getElementById('loading-overlay').innerHTML = '<div class="text-center p-4 sm:p-5 bg-white rounded-lg shadow-md max-w-xs sm:max-w-sm"><div class="text-red-600 text-xl sm:text-2xl mb-3"><i data-lucide="alert-triangle"></i></div><p class="text-base sm:text-lg font-semibold text-red-700">Erro ao iniciar o sistema.</p><p class="text-slate-600 mt-2 text-sm sm:text-base">Verifique sua conexão com a internet e tente novamente.</p></div>';
        createIcons();
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// ---- Funções de Renderização ----
function renderEntityInLibrary(entity) {
    const list = document.getElementById('entity-list');
    const template = document.getElementById('entity-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.entity-card');
    card.dataset.entityId = entity.id;
    card.dataset.entityName = entity.name;
    card.dataset.entityIcon = entity.icon; 
    
    const iconEl = clone.querySelector('.entity-icon');
    iconEl.setAttribute('data-lucide', entity.icon || 'box'); 

    clone.querySelector('.entity-name').textContent = entity.name;
    
    if (entity.id.startsWith('-')) { // Assumindo que IDs do Firebase começam com '-'
        clone.querySelector('.delete-custom-entity-btn').classList.remove('hidden');
    }
    
    list.appendChild(clone);
    createIcons();
    
    // Configurar Sortable.js para arrastar entidades da biblioteca
    if (list && !list._sortable) {
        list._sortable = new Sortable(list, { 
            group: { name: 'entities', pull: 'clone', put: false }, 
            sort: false, 
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            delay: 50, // Delay para dispositivos móveis
            delayOnTouchOnly: true, // Aplicar delay apenas em touch
        });
    }
}

function renderModule(moduleData) {
    const container = document.getElementById('module-container');
    const template = document.getElementById('module-template');
    const clone = template.content.cloneNode(true);
    const moduleEl = clone.querySelector('.module-quadro');
    
    moduleEl.dataset.moduleId = moduleData.id;
    clone.querySelector('.module-title').textContent = moduleData.name;
    
    container.appendChild(clone);
    const newModuleEl = container.querySelector(`[data-module-id="${moduleData.id}"]`);
    setupDragAndDropForModule(newModuleEl);
    createIcons();
    
    // Adiciona classe de animação e a remove após a animação
    newModuleEl.classList.add('animate-pulse');
    setTimeout(() => newModuleEl.classList.remove('animate-pulse'), 2000);
    
    return newModuleEl;
}

function renderDroppedEntity(moduleId, entityId, entityData, entityInfo) {
    const moduleEl = document.querySelector(`.module-quadro[data-module-id="${moduleId}"]`);
    if (!moduleEl) return;
    
    const dropzone = moduleEl.querySelector('.entities-dropzone');
    const template = document.getElementById('dropped-entity-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.dropped-entity-card');
    card.dataset.entityId = entityId;
    card.dataset.entityName = entityData.entityName;
    card.dataset.moduleId = moduleId;
    
    const iconEl = clone.querySelector('.entity-icon');
    if (entityInfo) {
       iconEl.setAttribute('data-lucide', entityInfo.icon || 'box');
    } else {
       iconEl.style.display = 'none';
    }

    clone.querySelector('.entity-name').textContent = entityData.entityName;
    card.classList.remove('animate-pulse');
    dropzone.appendChild(clone);
    createIcons();
}

function populateFieldsToolbox() {
    const toolbox = document.getElementById('fields-toolbox');
    if (!toolbox) return;
    
    toolbox.innerHTML = '';
    fieldTypes.forEach(field => {
        const clone = document.getElementById('toolbox-field-template').content.cloneNode(true);
        const item = clone.querySelector('.toolbox-item');
        item.dataset.fieldType = field.type;
        const iconEl = clone.querySelector('.field-icon');
        iconEl.setAttribute('data-lucide', field.icon);
        clone.querySelector('.field-name').textContent = field.name;
        toolbox.appendChild(clone);
    });
    createIcons();
    
    // Configurar Sortable.js para arrastar campos da caixa de ferramentas
    if (toolbox && !toolbox._sortable) {
        toolbox._sortable = new Sortable(toolbox, { 
            group: { name: 'fields', pull: 'clone', put: false }, 
            sort: false, 
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            delay: 50, // Delay para dispositivos móveis
            delayOnTouchOnly: true, // Aplicar delay apenas em touch
        });
    }
}

function renderFormField(fieldData) {
    const dropzone = document.getElementById('form-builder-dropzone');
    if (!dropzone) return;
    
    const template = document.getElementById('form-field-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.form-field-card');
    card.dataset.fieldId = fieldData.id;
    card.dataset.fieldData = JSON.stringify(fieldData);
    const fieldInfo = fieldTypes.find(f => f.type === fieldData.type);
    
    const iconEl = clone.querySelector('.field-icon');
    iconEl.setAttribute('data-lucide', fieldInfo.icon);
    
    clone.querySelector('.field-label').textContent = fieldData.label;
    
    if (fieldData.type === 'sub-entity') {
        clone.querySelector('.field-type').textContent = fieldData.subType === 'independent' ? 
            `Sub-Entidade` : 
            `Relação → ${fieldData.targetEntityName}`;
        clone.querySelector('.edit-sub-entity-btn').classList.remove('hidden');
        clone.querySelector('.edit-field-btn').style.display = 'none';
    } else {
        clone.querySelector('.field-type').textContent = fieldInfo.name;
    }
    
    dropzone.appendChild(clone);
    
    // Adiciona classe de animação e a remove após a animação
    const newField = dropzone.lastElementChild;
    newField.classList.add('animate-pulse');
    setTimeout(() => newField.classList.remove('animate-pulse'), 2000);
    
    createIcons();
    
    // Verifica se o formulário está vazio
    const emptyFormState = document.getElementById('empty-form-state');
    if (emptyFormState) {
        if (dropzone.children.length > 0) {
            emptyFormState.classList.add('hidden');
        } else {
            emptyFormState.classList.remove('hidden');
        }
    }
}

function updateModalBreadcrumb() {
    const breadcrumbContainer = document.getElementById('modal-breadcrumb');
    const backBtn = document.getElementById('modal-back-btn');
    if (!breadcrumbContainer || !backBtn) return;
    
    breadcrumbContainer.innerHTML = '';
    
    if (modalNavigationStack.length === 0) {
        backBtn.classList.add('hidden');
        const context = JSON.parse(document.getElementById('entity-builder-modal').dataset.context);
        const titleSpan = document.createElement('span');
        titleSpan.className = 'font-bold text-indigo-800';
        titleSpan.innerHTML = `<i data-lucide="file-edit" class="inline h-4 w-4 sm:h-5 sm:w-5 mr-1 text-indigo-600"></i> <span class="text-slate-800">${context.entityName}</span>`;
        breadcrumbContainer.appendChild(titleSpan);
    } else {
        backBtn.classList.remove('hidden');
        // Em telas pequenas, mostrar apenas o último item
        if (window.innerWidth < 640) {
            const currentContext = JSON.parse(document.getElementById('entity-builder-modal').dataset.context);
            const currentTitleSpan = document.createElement('span');
            currentTitleSpan.className = 'font-semibold text-indigo-800';
            currentTitleSpan.textContent = currentContext.label || currentContext.entityName;
            breadcrumbContainer.appendChild(currentTitleSpan);
        } else {
            // Em telas maiores, mostrar toda a navegação
            modalNavigationStack.forEach((state, index) => {
                const nameSpan = document.createElement('span');
                nameSpan.textContent = state.entityName || state.label;
                nameSpan.className = 'text-slate-500 truncate';
                breadcrumbContainer.appendChild(nameSpan);
                
                if (index < modalNavigationStack.length - 1) {
                    const separator = document.createElement('span');
                    separator.className = 'mx-1 sm:mx-2 text-slate-400';
                    separator.innerHTML = `<i data-lucide="chevron-right" class="inline h-3 w-3 sm:h-4 sm:w-4"></i>`;
                    breadcrumbContainer.appendChild(separator);
                } else {
                    const separator = document.createElement('span');
                    separator.className = 'mx-1 sm:mx-2 text-slate-400';
                    separator.innerHTML = `<i data-lucide="chevron-right" class="inline h-3 w-3 sm:h-4 sm:w-4"></i>`;
                    breadcrumbContainer.appendChild(separator);
                }
            });
            
            const context = JSON.parse(document.getElementById('entity-builder-modal').dataset.context);
            const currentTitleSpan = document.createElement('span');
            currentTitleSpan.className = 'font-semibold text-indigo-800 truncate';
            currentTitleSpan.textContent = context.label || context.entityName;
            breadcrumbContainer.appendChild(currentTitleSpan);
        }
    }
    
    createIcons();
}

// ---- Funções de Interação ----
function setupDragAndDropForModule(moduleElement) {
    const dropzone = moduleElement.querySelector('.entities-dropzone');
    if (!dropzone || dropzone._sortable) return;
    
    dropzone._sortable = new Sortable(dropzone, { 
        group: 'entities', 
        animation: 150, 
        onAdd: handleEntityDrop,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        delay: 50, // Delay para dispositivos móveis
        delayOnTouchOnly: true, // Aplicar delay apenas em touch
    });
}

function setupEventListeners() {
    // Configurar listeners para o container de módulos (para organizar a ordem)
    const moduleContainer = document.getElementById('module-container');
    if (moduleContainer && !moduleContainer._sortable) {
        moduleContainer._sortable = new Sortable(moduleContainer, {
            animation: 150,
            handle: '.module-quadro',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            delay: 150, // Delay para evitar arrastar acidentalmente em dispositivos móveis
            delayOnTouchOnly: true,
            onEnd: function(evt) {
                const moduleElements = document.querySelectorAll('.module-quadro');
                const newOrder = Array.from(moduleElements).map(el => el.dataset.moduleId);
                saveModulesOrder(newOrder);
            }
        });
    }

    // Delegação de eventos para botões de entidades e módulos
    document.body.addEventListener('click', e => {
        const configureBtn = e.target.closest('.configure-btn');
        if (configureBtn) {
            const card = configureBtn.closest('.dropped-entity-card');
            openModal({ moduleId: card.dataset.moduleId, entityId: card.dataset.entityId, entityName: card.dataset.entityName });
            return;
        }
        
        const deleteEntityBtn = e.target.closest('.delete-entity-btn');
        if (deleteEntityBtn) { 
            confirmAndRemoveEntityFromModule(deleteEntityBtn.closest('.dropped-entity-card')); 
            return; 
        }
        
        const deleteCustomEntityBtn = e.target.closest('.delete-custom-entity-btn');
        if (deleteCustomEntityBtn) { 
            confirmAndRemoveCustomEntity(deleteCustomEntityBtn.closest('.entity-card')); 
            return; 
        }
        
        const deleteModuleBtn = e.target.closest('.delete-module-btn');
        if (deleteModuleBtn) { 
            confirmAndRemoveModule(deleteModuleBtn.closest('.module-quadro')); 
            return; 
        }
        
        const editSubEntityBtn = e.target.closest('.edit-sub-entity-btn');
        if (editSubEntityBtn) { 
            handleEditSubEntity(editSubEntityBtn); 
            return; 
        }
    });
    
    // Botões principais
    const addNewEntityBtn = document.getElementById('add-new-entity-btn');
    if (addNewEntityBtn) {
        addNewEntityBtn.addEventListener('click', handleAddNewEntity);
    }
    
    const addNewModuleBtn = document.getElementById('add-new-module-btn');
    if (addNewModuleBtn) {
        addNewModuleBtn.addEventListener('click', handleAddNewModule);
    }
    
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    const saveStructureBtn = document.getElementById('save-structure-btn');
    if (saveStructureBtn) {
        saveStructureBtn.addEventListener('click', saveCurrentStructure);
    }
    
    const modalBackBtn = document.getElementById('modal-back-btn');
    if (modalBackBtn) {
        modalBackBtn.addEventListener('click', handleModalBack);
    }
    
    // Botão adicional para estado vazio
    const emptyAddModuleBtn = document.getElementById('empty-add-module-btn');
    if (emptyAddModuleBtn) {
        emptyAddModuleBtn.addEventListener('click', handleAddNewModule);
    }
    
    // Botão flutuante para adicionar módulo em dispositivos móveis
    const mobileAddModuleBtn = document.getElementById('mobile-add-module-btn');
    if (mobileAddModuleBtn) {
        mobileAddModuleBtn.addEventListener('click', handleAddNewModule);
    }

    // Gerenciamento de campos no formulário
    const formBuilderDropzone = document.getElementById('form-builder-dropzone');
    if (formBuilderDropzone) {
        // Configurar Sortable.js para o formulário
        if (!formBuilderDropzone._sortable) {
            formBuilderDropzone._sortable = new Sortable(formBuilderDropzone, { 
                group: 'fields', 
                animation: 150, 
                onAdd: handleFieldDrop, 
                handle: '[data-lucide="grip-vertical"]',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                delay: 50, // Delay para dispositivos móveis
                delayOnTouchOnly: true, // Aplicar delay apenas em touch
            });
        }
        
        formBuilderDropzone.addEventListener('click', e => {
             const deleteBtn = e.target.closest('.delete-field-btn');
             if (deleteBtn) {
                showConfirmDialog('Tem certeza?', "Não poderá reverter esta ação!", 'Sim, eliminar!', 'Cancelar', 'warning')
                .then(confirmed => { 
                    if (confirmed) { 
                        const fieldCard = deleteBtn.closest('.form-field-card');
                        const fieldName = fieldCard.querySelector('.field-label').textContent;
                        fieldCard.remove();
                        
                        showSuccess('Eliminado!', `O campo "${fieldName}" foi removido.`);
                        
                        // Verifica se o formulário está vazio
                        const dropzone = document.getElementById('form-builder-dropzone');
                        const emptyFormState = document.getElementById('empty-form-state');
                        if (dropzone.children.length === 0 && emptyFormState) {
                            emptyFormState.classList.remove('hidden');
                        }
                    } 
                });
             }
        });
    }
    
    // Adicionar ouvinte de redimensionamento para atualizar a navegação do breadcrumb
    window.addEventListener('resize', () => {
        const entityBuilderModal = document.getElementById('entity-builder-modal');
        if (entityBuilderModal && !entityBuilderModal.classList.contains('hidden')) {
            updateModalBreadcrumb();
        }
    });
}

async function handleEntityDrop(event) {
    const { item, to } = event;
    const { entityId, entityName, entityIcon } = item.dataset;
    const moduleEl = to.closest('.module-quadro');
    const moduleId = moduleEl.dataset.moduleId;

    // Verifica se a entidade já existe neste módulo
    if (moduleEl.querySelector(`.dropped-entity-card[data-entity-id="${entityId}"]`)) {
        item.remove();
        showError('Entidade já existe!', `A entidade "${entityName}" já está presente neste módulo.`);
        return;
    }
    
    // Remove o item original e adiciona o cartão de entidade
    item.remove();
    
    // Cria e adiciona o cartão da entidade
    const template = document.getElementById('dropped-entity-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.dropped-entity-card');
    card.dataset.entityId = entityId;
    card.dataset.entityName = entityName;
    card.dataset.moduleId = moduleId;
    
    const iconEl = clone.querySelector('.entity-icon');
    if (entityIcon) {
       iconEl.setAttribute('data-lucide', entityIcon);
    } else {
       iconEl.style.display = 'none';
    }

    clone.querySelector('.entity-name').textContent = entityName;
    to.appendChild(clone);
    createIcons();
    
    // Adiciona classe de animação temporária
    const entityCard = to.querySelector(`.dropped-entity-card[data-entity-id="${entityId}"]`);
    if (entityCard) {
        setTimeout(() => {
            entityCard.classList.remove('animate-pulse');
        }, 2000);
    }
    
    // Salva a entidade no módulo
    await saveEntityToModule(moduleId, entityId, entityName);
    
    // Notificação de sucesso
    showSuccess('Entidade adicionada!', 'Clique em configurar para definir seus campos.');
}

async function handleFieldDrop(event) {
    const { item } = event;
    const fieldType = item.dataset.fieldType;
    item.remove();

    if (fieldType === 'sub-entity') {
        const choice = await showConfirmDialog(
            'Como deseja criar esta tabela?',
            'Pode criar uma sub-entidade nova ou ligar a uma que já existe.',
            'Criar Nova',
            'Ligar a Existente',
            'info'
        );

        if (choice === true) {
            // Criar nova sub-entidade
            const result = await showInputDialog(
                'Nome da Nova Sub-Entidade',
                'Nome',
                'Ex: Endereços, Contactos'
            );
            
            if (result.confirmed && result.value) {
                const fieldData = { 
                    id: `field_${Date.now()}`, 
                    type: 'sub-entity', 
                    label: result.value, 
                    subType: 'independent', 
                    subSchema: { attributes: [] } 
                };
                renderFormField(fieldData);
            }
        } else if (choice === false) {
            // Ligar a entidade existente
            // Este código precisaria ser adaptado para usar as entidades do banco de dados
            const currentEntityId = JSON.parse(document.getElementById('entity-builder-modal').dataset.context).entityId;
            const allEntities = await loadAllEntities();
            const availableEntities = allEntities.filter(e => e.id !== currentEntityId);
            
            if (availableEntities.length === 0) {
                showError('Aviso', 'Não existem outras entidades para criar uma ligação. Crie pelo menos uma outra entidade primeiro.');
                return;
            }
            
            // Implementação simplificada - na versão final usaria um modal mais elaborado
            const entityOptions = availableEntities.map(e => `<option value="${e.id}|${e.name}">${e.name}</option>`).join('');
            
            // Este é um exemplo simplificado - idealmente usaria um componente de UI mais elaborado
            const htmlContent = `
                <div class="mb-4">
                    <label for="swal-input-label" class="block text-sm font-medium text-slate-700 mb-1 text-left">Nome do Campo</label>
                    <input id="swal-input-label" class="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ex: Cliente Associado">
                </div>
                <div>
                    <label for="swal-input-target-entity" class="block text-sm font-medium text-slate-700 mb-1 text-left">Ligar a qual entidade?</label>
                    <select id="swal-input-target-entity" class="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">${entityOptions}</select>
                </div>
            `;
            
            if (typeof Swal !== 'undefined') {
                const { value: formValues, isConfirmed } = await Swal.fire({
                    title: 'Ligar a uma Entidade Existente',
                    html: htmlContent,
                    showCancelButton: true,
                    focusConfirm: false,
                    customClass: {
                        popup: 'shadow-xl rounded-xl'
                    },
                    preConfirm: () => {
                        const label = document.getElementById('swal-input-label').value;
                        const selectElement = document.getElementById('swal-input-target-entity');
                        const [targetEntityId, targetEntityName] = selectElement.value.split('|');
                        if (!label) { 
                            Swal.showValidationMessage('O nome do campo é obrigatório.'); 
                            return false; 
                        }
                        return { label, targetEntityId, targetEntityName };
                    }
                });
                
                if(isConfirmed && formValues) {
                    const fieldData = { 
                        id: `field_${Date.now()}`, 
                        type: 'sub-entity', 
                        ...formValues, 
                        subType: 'relationship' 
                    };
                    renderFormField(fieldData);
                }
            }
        }
    } else {
        // Para campos normais
        const result = await showInputDialog(
            'Adicionar Campo',
            'Nome do Campo',
            'Ex: Nome Fantasia'
        );
        
        if (result.confirmed && result.value) {
            const fieldData = { id: `field_${Date.now()}`, type: fieldType, label: result.value };
            renderFormField(fieldData);
            showSuccess('Campo adicionado!', '');
        }
    }
}

function openModal(context) {
    const modal = document.getElementById('entity-builder-modal');
    if (!modal) return;
    
    modal.dataset.context = JSON.stringify(context);
    
    updateModalBreadcrumb();
    const dropzone = document.getElementById('form-builder-dropzone');
    if (dropzone) {
        dropzone.innerHTML = '';
    }
    
    // Certifique-se de que o sidebar modal esteja visível em desktop, mas escondido em mobile
    const modalSidebarContent = document.getElementById('modal-sidebar-content');
    if (modalSidebarContent) {
        if (window.innerWidth >= 640) {
            modalSidebarContent.classList.remove('hidden');
        } else {
            modalSidebarContent.classList.add('hidden');
        }
    }
    
    // Resetar o ícone do toggle da sidebar do modal
    const toggleModalSidebar = document.getElementById('toggle-modal-sidebar');
    if (toggleModalSidebar) {
        const icon = toggleModalSidebar.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'chevron-down');
            createIcons();
        }
    }

    if (context.isSubEntity) {
        (context.subSchema.attributes || []).forEach(renderFormField);
    } else {
        loadStructureForEntity(context.moduleId, context.entityId)
            .then(schema => {
                if (schema && schema.attributes && schema.attributes.length > 0) {
                    schema.attributes.forEach(renderFormField);
                }
            });
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0'), 10);
}

function closeModal() {
    const modal = document.getElementById('entity-builder-modal');
    if (!modal) return;
    
    modal.querySelector('.bg-white').classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modalNavigationStack = [];
    }, 300);
}

async function handleAddNewEntity() {
    // Prepara o HTML para os ícones
    const iconHtml = availableEntityIcons.map(icon => 
        `<button class="icon-picker-btn p-2 rounded-md hover:bg-indigo-100 transition-all" data-icon="${icon}">
            <div class="h-6 w-6 sm:h-8 sm:w-8 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600">
                <i data-lucide="${icon}"></i>
            </div>
         </button>`
    ).join('');
    
    // Implementação simplificada - na versão final usaria um componente de UI mais elaborado
    if (typeof Swal !== 'undefined') {
        const { value: formValues, isConfirmed } = await Swal.fire({
            title: 'Criar Nova Entidade',
            html: `
                <div class="mb-4">
                    <label for="swal-input-name" class="block text-sm font-medium text-slate-700 mb-1 text-left">Nome da Entidade</label>
                    <input id="swal-input-name" class="swal2-input w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ex: Fornecedor, Produto, Funcionário...">
                </div>
                <div>
                    <p class="text-sm font-medium text-slate-700 mb-2 text-left">Escolha um ícone:</p>
                    <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">${iconHtml}</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Criar Entidade',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            customClass: {
                popup: 'shadow-xl rounded-xl'
            },
            didOpen: () => {
                createIcons();
                document.querySelector('#swal2-html-container').addEventListener('click', e => {
                    const button = e.target.closest('.icon-picker-btn');
                    if (button) {
                        document.querySelectorAll('.icon-picker-btn').forEach(btn => btn.classList.remove('bg-indigo-200'));
                        button.classList.add('bg-indigo-200');
                    }
                });
            },
            preConfirm: () => {
                const name = document.getElementById('swal-input-name').value;
                const selectedIconEl = document.querySelector('.icon-picker-btn.bg-indigo-200');
                if (!name) { 
                    Swal.showValidationMessage('O nome da entidade é obrigatório.'); 
                    return false; 
                }
                if (!selectedIconEl) { 
                    Swal.showValidationMessage('Por favor, escolha um ícone.'); 
                    return false; 
                }
                return { name, icon: selectedIconEl.dataset.icon };
            }
        });
        
        if (isConfirmed && formValues) {
            showLoading('Criando entidade...');
            
            try {
                const entityId = await createEntity({ 
                    name: formValues.name, 
                    icon: formValues.icon 
                });
                
                // Recarregar entidades e renderizar a nova
                await loadAllEntities();
                
                hideLoading();
                showSuccess('Entidade Criada!', `A entidade "${formValues.name}" está pronta para ser usada.`);
            } catch (error) {
                hideLoading();
                showError('Erro', 'Ocorreu um erro ao criar a entidade. Tente novamente.');
            }
        }
    }
}

async function handleAddNewModule() {
    const result = await showInputDialog(
        'Criar Novo Módulo',
        'Nome do Módulo',
        'Ex: Vendas, Recursos Humanos, Financeiro...'
    );
    
    if (result.confirmed && result.value) {
        showLoading('Criando módulo...');
        
        try {
            const moduleId = await createModule(result.value);
            
            // Renderiza o novo módulo
            const moduleEl = renderModule({ id: moduleId, name: result.value });
            checkEmptyStates();
            
            hideLoading();
            showSuccess('Módulo Criado!', `O módulo "${result.value}" foi criado com sucesso.`);
            
            // Dica após criar o primeiro módulo
            if (document.querySelectorAll('.module-quadro').length === 1) {
                setTimeout(() => {
                    showSuccess('Dica', 'Agora arraste entidades da biblioteca para o seu novo módulo.');
                }, 1000);
            }
        } catch (error) {
            hideLoading();
            showError('Erro', 'Ocorreu um erro ao criar o módulo. Tente novamente.');
        }
    }
}

function handleEditSubEntity(button) {
    const card = button.closest('.form-field-card');
    const fieldData = JSON.parse(card.dataset.fieldData);
    
    if (fieldData.subType === 'independent') {
        const parentContext = JSON.parse(document.getElementById('entity-builder-modal').dataset.context);
        modalNavigationStack.push(parentContext);
        
        openModal({
            isSubEntity: true,
            label: fieldData.label,
            parentFieldId: fieldData.id,
            subSchema: fieldData.subSchema,
        });
    } else if (fieldData.subType === 'relationship') {
        const allEntities = getEntities();
        const targetEntity = allEntities.find(e => e.id === fieldData.targetEntityId);
        if (!targetEntity) {
            showError('Erro', 'A entidade relacionada já não existe.');
            return;
        }
        
        const parentContext = JSON.parse(document.getElementById('entity-builder-modal').dataset.context);
        modalNavigationStack.push(parentContext);

        openModal({
            moduleId: 'system', // A entidade relacionada é global, não pertence a um módulo específico neste contexto
            entityId: targetEntity.id,
            entityName: targetEntity.name,
        });
    }
}

function handleModalBack() {
    if (modalNavigationStack.length > 0) {
        const parentContext = modalNavigationStack.pop();
        openModal(parentContext);
    }
}

async function confirmAndRemoveEntityFromModule(card) {
    const { entityName, moduleId, entityId } = card.dataset;
    
    const confirmed = await showConfirmDialog(
        `Remover '${entityName}'?`,
        'Tem a certeza que deseja remover esta entidade do módulo?',
        'Sim, remover!',
        'Cancelar',
        'warning'
    );
    
    if (confirmed) { 
        try {
            await deleteEntityFromModule(moduleId, entityId);
            card.remove();
            showSuccess('Removido!', `A entidade "${entityName}" foi removida do módulo.`);
        } catch (error) {
            showError('Erro', 'Ocorreu um erro ao remover a entidade. Tente novamente.');
        }
    }
}

async function confirmAndRemoveCustomEntity(card) {
    const { entityId, entityName } = card.dataset;
    
    const confirmed = await showConfirmDialog(
        'Eliminar Entidade?',
        `Isto irá remover <strong>${entityName}</strong> da biblioteca e de <strong>todos os módulos</strong>.<br><br><span class="font-bold text-red-600">Esta ação é PERMANENTE.</span>`,
        'Sim, eliminar!',
        'Cancelar',
        'danger'
    );
    
    if (confirmed) {
        showLoading('Eliminando entidade...');
        
        try {
            await deleteEntity(entityId);
            
            // Remove os cartões das entidades dos módulos
            document.querySelectorAll(`.dropped-entity-card[data-entity-id="${entityId}"]`).forEach(c => c.remove());
            
            hideLoading();
            showSuccess('Eliminado!', `A entidade "${entityName}" foi eliminada permanentemente.`);
        } catch (error) {
            hideLoading();
            showError('Erro', 'Ocorreu um erro ao eliminar a entidade. Tente novamente.');
        }
    }
}

async function confirmAndRemoveModule(moduleEl) {
    const moduleId = moduleEl.dataset.moduleId;
    const moduleName = moduleEl.querySelector('.module-title').textContent;
    
    const confirmed = await showConfirmDialog(
        'Eliminar Módulo?',
        `Isto irá remover <strong>${moduleName}</strong> e <strong>TODAS as entidades</strong> dentro dele.<br><br><span class="font-bold text-red-600">Esta ação é PERMANENTE.</span>`,
        'Sim, eliminar!',
        'Cancelar',
        'danger'
    );
    
    if (confirmed) {
        showLoading('Eliminando módulo...');
        
        try {
            await deleteModule(moduleId);
            moduleEl.remove();
            checkEmptyStates();
            
            hideLoading();
            showSuccess('Eliminado!', `O módulo "${moduleName}" foi eliminado permanentemente.`);
        } catch (error) {
            hideLoading();
            showError('Erro', 'Ocorreu um erro ao eliminar o módulo. Tente novamente.');
        }
    }
}

async function saveCurrentStructure() {
    const modal = document.getElementById('entity-builder-modal');
    const context = JSON.parse(modal.dataset.context);
    const fieldCards = document.getElementById('form-builder-dropzone').querySelectorAll('.form-field-card');
    const attributes = Array.from(fieldCards).map(card => JSON.parse(card.dataset.fieldData));

    showLoading('Guardando estrutura...');

    try {
        if (context.isSubEntity) {
            // Guardar a estrutura da sub-entidade de volta no seu campo pai
            const parentContext = modalNavigationStack[modalNavigationStack.length - 1];
            await saveSubEntityStructure(parentContext.moduleId, parentContext.entityId, context.parentFieldId, attributes);
            
            hideLoading();
            showSuccess('Guardado!', 'A estrutura da sub-entidade foi guardada com sucesso.');
        } else {
            // Guardar a estrutura da entidade principal
            await saveEntityStructure(context.moduleId, context.entityId, context.entityName, attributes);
            
            hideLoading();
            showSuccess('Guardado!', `A estrutura da entidade "${context.entityName}" foi guardada com sucesso.`);
        }
    } catch (error) {
        hideLoading();
        showError('Erro', 'Ocorreu um erro ao guardar a estrutura. Tente novamente.');
    }
}

// Exporta funções públicas
export {
    renderEntityInLibrary,
    renderModule,
    renderDroppedEntity,
    renderFormField,
    openModal,
    closeModal
};