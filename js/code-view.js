// Estrutura de arquivos e diretórios do sistema
const fileStructure = {
    'index.html': { path: '../index.html', type: 'html' },
    'css/style.css': { path: '../css/style.css', type: 'css' },
    'js/config.js': { path: '../js/config.js', type: 'javascript' },
    'js/autenticacao.js': { path: '../js/autenticacao.js', type: 'javascript' },
    'js/database.js': { path: '../js/database.js', type: 'javascript' },
    'js/ui.js': { path: '../js/ui.js', type: 'javascript' },
    'js/main.js': { path: '../js/main.js', type: 'javascript' },
    'js/workspaces.js': { path: '../js/workspaces.js', type: 'javascript' },
    'js/login.js': { path: '../js/login.js', type: 'javascript' },
    'js/code-view.js': { path: '../js/code-view.js', type: 'javascript' },
    'js/user/userProfile.js': { path: '../js/user/userProfile.js', type: 'javascript' },
    'js/user/invitations.js': { path: '../js/user/invitations.js', type: 'javascript' },
    'pages/login.html': { path: '../pages/login.html', type: 'html' },
    'pages/code-view.html': { path: '../pages/code-view.html', type: 'html' },
    'YOUWARE.md': { path: '../YOUWARE.md', type: 'markdown' }
};

// Código fonte dos arquivos
const sourceCode = {};
let currentFile = 'index.html';

// Inicializa a página
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializa ícones Lucide
    if (typeof lucide !== 'undefined' && lucide) {
        lucide.createIcons();
    }
    
    // Gera as abas para navegação de arquivos
    generateFileTabs();
    
    // Configura os event listeners para as abas
    setupTabButtons();
    
    // Configura os botões de ação
    setupActionButtons();
    
    // Carrega o código-fonte de todos os arquivos
    await fetchAllSourceCode();
    
    // Exibe o código do primeiro arquivo
    displayFileCode(currentFile);
});

// Gera as abas para navegação de arquivos
function generateFileTabs() {
    const tabsContainer = document.getElementById('file-tabs');
    tabsContainer.innerHTML = '';
    
    // Agrupa os arquivos por diretório
    const groups = {};
    
    for (const filePath in fileStructure) {
        const parts = filePath.split('/');
        const dir = parts.length > 1 ? parts[0] : 'root';
        
        if (!groups[dir]) {
            groups[dir] = [];
        }
        
        groups[dir].push({
            path: filePath,
            name: parts[parts.length - 1]
        });
    }
    
    // Adiciona os arquivos da raiz primeiro
    if (groups['root']) {
        groups['root'].forEach(file => {
            tabsContainer.appendChild(createTabButton(file.path, file.name, file.path === currentFile));
        });
    }
    
    // Adiciona os arquivos agrupados por diretório
    for (const dir in groups) {
        if (dir !== 'root') {
            // Adiciona um separador entre os grupos
            const separator = document.createElement('div');
            separator.className = 'text-xs text-slate-400 px-2 py-1 mx-1 border-l border-slate-200';
            separator.textContent = dir;
            tabsContainer.appendChild(separator);
            
            // Adiciona os arquivos do diretório
            groups[dir].forEach(file => {
                tabsContainer.appendChild(createTabButton(file.path, file.name, file.path === currentFile));
            });
        }
    }
}

// Cria um botão de aba para um arquivo
function createTabButton(filePath, fileName, isActive) {
    const button = document.createElement('button');
    button.className = `tab-button px-3 py-1.5 text-sm font-medium ${isActive ? 'active text-slate-800' : 'text-slate-600'} hover:bg-slate-100 rounded-md`;
    button.dataset.file = filePath;
    button.textContent = fileName;
    return button;
}

// Configura os event listeners para as abas
function setupTabButtons() {
    document.getElementById('file-tabs').addEventListener('click', (e) => {
        const button = e.target.closest('.tab-button');
        if (!button) return;
        
        // Remove a classe "active" de todos os botões
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('text-slate-600');
            btn.classList.remove('text-slate-800');
        });
        
        // Adiciona a classe "active" ao botão clicado
        button.classList.add('active');
        button.classList.remove('text-slate-600');
        button.classList.add('text-slate-800');
        
        // Atualiza o arquivo atual e exibe seu código
        currentFile = button.dataset.file;
        displayFileCode(currentFile);
    });
}

// Configura os botões de ação
function setupActionButtons() {
    // Botão para copiar o arquivo atual
    document.getElementById('copy-file-btn').addEventListener('click', () => {
        copyToClipboard(sourceCode[currentFile]);
        showToast('Código copiado!', 'success');
    });
    
    // Botão para baixar o arquivo atual
    document.getElementById('download-file-btn').addEventListener('click', () => {
        downloadSingleFile(currentFile, sourceCode[currentFile]);
    });
    
    // Botão para baixar todos os arquivos
    document.getElementById('download-all-btn').addEventListener('click', () => {
        downloadAllFiles();
    });
    
    // Botão para copiar todos os arquivos
    document.getElementById('copy-all-btn').addEventListener('click', () => {
        const allCode = Object.entries(sourceCode).map(([filename, code]) => {
            return `/* ========== ${filename} ========== */\n\n${code}\n\n`;
        }).join('\n');
        
        copyToClipboard(allCode);
        showToast('Todos os códigos copiados!', 'success');
    });
}

// Busca o código-fonte de todos os arquivos
async function fetchAllSourceCode() {
    const files = Object.keys(fileStructure);
    
    // Exibe um indicador de carregamento
    document.getElementById('code-display').textContent = 'Carregando arquivos...';
    
    try {
        // Busca cada arquivo em paralelo
        const promises = files.map(file => fetchFileContent(file));
        await Promise.all(promises);
    } catch (error) {
        console.error('Erro ao carregar arquivos:', error);
        document.getElementById('code-display').textContent = 'Erro ao carregar os arquivos.';
        showToast('Erro ao carregar os arquivos.', 'error');
    }
}

// Busca o conteúdo de um arquivo
async function fetchFileContent(filename) {
    try {
        const fileInfo = fileStructure[filename];
        if (!fileInfo) {
            throw new Error(`Arquivo ${filename} não encontrado na estrutura`);
        }
        
        const response = await fetch(fileInfo.path);
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const code = await response.text();
        sourceCode[filename] = code;
        return code;
    } catch (error) {
        console.error(`Erro ao carregar ${filename}:`, error);
        sourceCode[filename] = `// Erro ao carregar ${filename}\n// ${error.message}`;
    }
}

// Exibe o código de um arquivo
function displayFileCode(filename) {
    const codeDisplay = document.getElementById('code-display');
    const currentFileElement = document.getElementById('current-file');
    
    // Atualiza o nome do arquivo atual
    currentFileElement.textContent = filename;
    
    // Atualiza a linguagem para o highlight
    const fileInfo = fileStructure[filename];
    codeDisplay.className = `language-${fileInfo ? fileInfo.type : 'plaintext'}`;
    
    // Exibe o código
    codeDisplay.textContent = sourceCode[filename] || `// Carregando ${filename}...`;
    
    // Aplica o highlight
    if (hljs && hljs.highlightElement) {
        hljs.highlightElement(codeDisplay);
    }
}

// Copia texto para a área de transferência
function copyToClipboard(text) {
    // Método moderno
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .catch(err => {
                console.error('Erro ao copiar texto:', err);
                fallbackCopyToClipboard(text);
            });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Método alternativo para copiar texto
function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Erro ao copiar texto:', err);
        showToast('Erro ao copiar o texto.', 'error');
    }
    
    document.body.removeChild(textarea);
}

// Baixa um único arquivo
function downloadSingleFile(filename, content) {
    // Extrai apenas o nome do arquivo sem o caminho
    const parts = filename.split('/');
    const simpleName = parts[parts.length - 1];
    
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, simpleName);
}

// Baixa todos os arquivos como um ZIP
function downloadAllFiles() {
    if (!JSZip) {
        showToast('Biblioteca JSZip não encontrada. Não é possível criar o ZIP.', 'error');
        return;
    }
    
    const zip = new JSZip();
    
    // Adiciona diretórios ao ZIP
    zip.folder('css');
    zip.folder('js');
    zip.folder('pages');
    
    // Adiciona cada arquivo ao ZIP respeitando a estrutura de diretórios
    Object.entries(sourceCode).forEach(([filename, content]) => {
        const parts = filename.split('/');
        
        if (parts.length === 1) {
            // Arquivo na raiz
            zip.file(filename, content);
        } else {
            // Arquivo em subdiretório
            zip.file(filename, content);
        }
    });
    
    // Gera o arquivo ZIP
    zip.generateAsync({ type: 'blob' })
        .then(function(content) {
            // Baixa o arquivo ZIP
            saveAs(content, 'construktor.zip');
        })
        .catch(function(error) {
            console.error('Erro ao gerar ZIP:', error);
            showToast('Erro ao gerar o arquivo ZIP.', 'error');
        });
}

// Exibe um toast de notificação
function showToast(message, icon) {
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            customClass: {
                popup: 'shadow-xl rounded-xl'
            }
        });
        
        Toast.fire({
            icon: icon,
            title: message
        });
    } else {
        alert(message);
    }
}