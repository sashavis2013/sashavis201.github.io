async function updateTaskStatus(taskId, newStatus) {
    const response = await apiCall(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
    });
    
    // Check if the API call was successful (returned something, even empty object)
    if (response !== null) {
        await loadTasks();
        showSuccess(`Task status updated to ${newStatus}!`);
    }
}

// Global functions for onclick handlers
window.showAuthForm = showAuthForm;
window.showSection = showSection;
window.logout = logout;
window.updateTaskStatus = updateTaskStatus;
window.showAddMemberForm = showAddMemberForm;
window.hideAddMemberForm = hideAddMemberForm;
window.addMemberToProject = addMemberToProject;
window.showProjectDetails = showProjectDetails;
window.switchView = switchView;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.saveTaskChanges = saveTaskChanges;// Configuration - Update this when deploying
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5052/api'  // Development
    : 'https://taskmanager-production-b30a.up.railway.app/api';
let users = [];
let projects = [];
let tasks = [];
let currentUser = null;
let currentTaskId = null;
let currentView = 'list';

// Authentication functions
function showAuthForm(formType, eventTarget = null) {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.add('hidden'));
    document.querySelectorAll('.auth-toggle .nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${formType}-form`).classList.remove('hidden');
    
    // Handle both event and programmatic calls
    const targetButton = eventTarget || 
        document.querySelector(`.auth-toggle .nav-btn[onclick*="${formType}"]`);
    
    if (targetButton) {
        targetButton.classList.add('active');
    }
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function removeAuthToken() {
    localStorage.removeItem('authToken');
}

function setCurrentUser(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = `Welcome, ${user.username}!`;
    }
}

function getCurrentUser() {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
}

function showAuthenticatedView() {
    const loginRegister = document.getElementById('login-register');
    const userInfo = document.getElementById('user-info');
    const mainNav = document.getElementById('main-nav');
    const mainContent = document.getElementById('main-content');
    
    if (loginRegister) loginRegister.style.display = 'none';
    if (userInfo) userInfo.classList.remove('hidden');
    if (mainNav) mainNav.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('authenticated');
    
    // Load initial data
    showSection('projects');
}

function showUnauthenticatedView() {
    const loginRegister = document.getElementById('login-register');
    const userInfo = document.getElementById('user-info');
    const mainNav = document.getElementById('main-nav');
    const mainContent = document.getElementById('main-content');
    
    if (loginRegister) loginRegister.style.display = 'block';
    if (userInfo) userInfo.classList.add('hidden');
    if (mainNav) mainNav.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('authenticated');
    currentUser = null;
}

async function login(email, password) {
    const submitBtn = document.querySelector('#login-form-element .btn');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.textContent = 'Logging in...';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Login failed');
        }

        const data = await response.json();
        setAuthToken(data.token);
        setCurrentUser(data.user);
        showAuthenticatedView();
        showSuccess('Login successful!');
        
    } catch (error) {
        showError(`Login failed: ${error.message}`);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

async function register(username, email, password) {
    const submitBtn = document.querySelector('#register-form-element .btn');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.textContent = 'Creating account...';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Registration failed');
        }

        const data = await response.json();
        setAuthToken(data.token);
        setCurrentUser(data.user);
        showAuthenticatedView();
        showSuccess('Registration successful!');
        
    } catch (error) {
        showError(`Registration failed: ${error.message}`);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

function logout() {
    removeAuthToken();
    localStorage.removeItem('currentUser');
    showUnauthenticatedView();
    showSuccess('Logged out successfully');
}

// Navigation
function showSection(sectionName, eventTarget = null) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('#main-nav .nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`${sectionName}-section`).classList.remove('hidden');
    
    // Mark nav button as active - handle both event and programmatic calls
    const targetButton = eventTarget || 
        document.querySelector(`#main-nav .nav-btn[onclick*="${sectionName}"]`) ||
        document.querySelector('#main-nav .nav-btn');
    
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    // Load data for the section
    if (sectionName === 'projects') {
        loadProjects();
        loadUsersForDropdowns();
    } else if (sectionName === 'tasks') {
        loadTasks();
        loadProjectsForDropdown();
        loadUsersForTaskDropdowns();
    }
}

// API calls
async function apiCall(endpoint, options = {}) {
    try {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers,
            ...options
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            logout();
            showError('Session expired. Please login again.');
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check if response has content before trying to parse JSON
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        
        if (contentLength === '0' || response.status === 204) {
            return {}; // Return empty object for NoContent responses
        }
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return {}; // Return empty object if not JSON
        }
        
    } catch (error) {
        console.error('API call failed:', error);
        showError(`API call failed: ${error.message}`);
        return null;
    }
}

// Projects functionality
async function loadProjects() {
    const projectsContainer = document.getElementById('projects-container');
    projectsContainer.innerHTML = '<div class="loading">Loading projects...</div>';
    
    projects = await apiCall('/projects');
    if (projects) {
        renderProjects();
    }
}

function renderProjects() {
    const container = document.getElementById('projects-container');
    if (projects.length === 0) {
        container.innerHTML = '<div class="loading">No projects found. Create your first project!</div>';
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="card">
            <h3>${project.name}</h3>
            <p>${project.description || 'No description'}</p>
            <p><strong>Owner:</strong> ${project.owner?.username || 'Unknown'}</p>
            <p><strong>Created:</strong> ${new Date(project.createdAt).toLocaleDateString()}</p>
            <p><strong>Tasks:</strong> ${project.tasksCount || 0}</p>
            ${project.isOwner ? '<span class="status-badge status-done">Owner</span>' : '<span class="status-badge status-todo">Member</span>'}
            ${project.isOwner ? `
                <div style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="showAddMemberForm(${project.id})">Add Member</button>
                    <button class="btn btn-secondary" onclick="showProjectDetails(${project.id})">View Details</button>
                </div>
            ` : ''}
            <div id="add-member-form-${project.id}" class="hidden" style="margin-top: 1rem;">
                <select id="user-select-${project.id}">
                    <option value="">Select User...</option>
                </select>
                <select id="role-select-${project.id}">
                    <option value="Viewer">Viewer</option>
                    <option value="Member" selected>Member</option>
                    <option value="Admin">Admin</option>
                </select>
                <button class="btn" onclick="addMemberToProject(${project.id})">Add</button>
                <button class="btn btn-secondary" onclick="hideAddMemberForm(${project.id})">Cancel</button>
            </div>
        </div>
    `).join('');
}

async function loadUsersForDropdowns() {
    if (users.length === 0) {
        users = await apiCall('/users') || [];
    }
}

// Tasks functionality
async function loadTasks() {
    const tasksContainer = document.getElementById('tasks-container');
    tasksContainer.innerHTML = '<div class="loading">Loading tasks...</div>';
    
    tasks = await apiCall('/tasks');
    if (tasks) {
        renderTasks();
    }
}

function renderTasks() {
    if (currentView === 'list') {
        renderListView();
    } else {
        renderKanbanView();
    }
}

function renderListView() {
    const container = document.getElementById('tasks-container');
    if (tasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks found. Create your first task!</div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="card priority-${task.priority.toLowerCase()}" onclick="openTaskModal(${task.id})">
            <h3>${task.title}</h3>
            <p>${task.description || 'No description'}</p>
            <p><strong>Project:</strong> ${task.project.name}</p>
            <p><strong>Assigned to:</strong> ${task.assignedToUser?.username || 'Unassigned'}</p>
            <p><strong>Created by:</strong> ${task.createdByUser.username}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p><strong>Due:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</p>
            <div style="margin-top: 1rem;">
                <span class="status-badge status-${task.status.toLowerCase()}">${task.status}</span>
            </div>
        </div>
    `).join('');
}

function renderKanbanView() {
    const todoTasks = tasks.filter(task => task.status === 'ToDo');
    const inProgressTasks = tasks.filter(task => task.status === 'InProgress');
    const doneTasks = tasks.filter(task => task.status === 'Done');
    
    // Update task counts
    document.getElementById('todo-count').textContent = todoTasks.length;
    document.getElementById('inprogress-count').textContent = inProgressTasks.length;
    document.getElementById('done-count').textContent = doneTasks.length;
    
    // Render tasks in each column
    document.getElementById('todo-tasks').innerHTML = todoTasks.map(task => createKanbanCard(task)).join('');
    document.getElementById('inprogress-tasks').innerHTML = inProgressTasks.map(task => createKanbanCard(task)).join('');
    document.getElementById('done-tasks').innerHTML = doneTasks.map(task => createKanbanCard(task)).join('');
    
    // Add drag and drop event listeners
    addDragAndDropListeners();
}

function createKanbanCard(task) {
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
    return `
        <div class="kanban-task priority-${task.priority.toLowerCase()}" 
             draggable="true" 
             data-task-id="${task.id}"
             onclick="openTaskModal(${task.id})">
            <h4>${task.title}</h4>
            <p>${task.description || 'No description'}</p>
            <div class="task-meta">
                <span class="task-assignee">${task.assignedToUser?.username || 'Unassigned'}</span>
                <span>${dueDate}</span>
            </div>
        </div>
    `;
}

function switchView(viewType) {
    currentView = viewType;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show/hide views
    if (viewType === 'list') {
        document.getElementById('list-view').style.display = 'block';
        document.getElementById('kanban-view').style.display = 'none';
    } else {
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('kanban-view').style.display = 'block';
    }
    
    // Re-render tasks in the selected view
    renderTasks();
}

async function loadProjectsForDropdown() {
    if (projects.length === 0) {
        projects = await apiCall('/projects') || [];
    }
    
    const select = document.getElementById('task-project');
    select.innerHTML = '<option value="">Select Project...</option>' + 
        projects.map(project => `<option value="${project.id}">${project.name}</option>`).join('');
}

async function loadUsersForTaskDropdowns() {
    if (users.length === 0) {
        users = await apiCall('/users') || [];
    }
    
    const assignedSelect = document.getElementById('task-assigned');
    const createdBySelect = document.getElementById('task-created-by');
    const projectSelect = document.getElementById('task-project');
    
    if (!assignedSelect || !createdBySelect || !projectSelect) return;
    
    // Get selected project
    const selectedProjectId = parseInt(projectSelect.value);
    let projectMembers = [];
    
    if (selectedProjectId) {
        // Get project details to find members
        const projectDetails = await apiCall(`/projects/${selectedProjectId}`);
        if (projectDetails) {
            projectMembers = [
                { id: projectDetails.owner.id, username: projectDetails.owner.username },
                ...(projectDetails.members || []).map(m => ({ id: m.id, username: m.username }))
            ];
        }
    }
    
    // For assignment dropdown, only show project members
    if (projectMembers.length > 0) {
        const memberOptions = projectMembers.map(user => `<option value="${user.id}">${user.username}</option>`).join('');
        assignedSelect.innerHTML = '<option value="">Unassigned</option>' + memberOptions;
    } else {
        assignedSelect.innerHTML = '<option value="">Select project first</option>';
    }
    
    // Set current user as default creator and make it selected
    if (currentUser) {
        createdBySelect.innerHTML = `<option value="${currentUser.id}" selected>${currentUser.username}</option>`;
    }
}

// Project member management functions
async function showAddMemberForm(projectId) {
    const form = document.getElementById(`add-member-form-${projectId}`);
    const userSelect = document.getElementById(`user-select-${projectId}`);
    
    if (form && userSelect) {
        form.classList.remove('hidden');
        
        // Load users for dropdown
        if (users.length === 0) {
            users = await apiCall('/users') || [];
        }
        
        // Get current project members to exclude them
        const projectDetails = await apiCall(`/projects/${projectId}`);
        const existingMemberIds = new Set();
        
        if (projectDetails) {
            existingMemberIds.add(projectDetails.owner.id);
            if (projectDetails.members) {
                projectDetails.members.forEach(member => existingMemberIds.add(member.id));
            }
        }
        
        // Filter out existing members
        const availableUsers = users.filter(user => !existingMemberIds.has(user.id));
        
        userSelect.innerHTML = '<option value="">Select User...</option>' + 
            availableUsers.map(user => `<option value="${user.id}">${user.username}</option>`).join('');
    }
}

function hideAddMemberForm(projectId) {
    const form = document.getElementById(`add-member-form-${projectId}`);
    if (form) {
        form.classList.add('hidden');
    }
}

async function addMemberToProject(projectId) {
    const userSelect = document.getElementById(`user-select-${projectId}`);
    const roleSelect = document.getElementById(`role-select-${projectId}`);
    
    if (!userSelect || !roleSelect) return;
    
    const userId = parseInt(userSelect.value);
    const role = roleSelect.value;
    
    if (!userId) {
        showError('Please select a user');
        return;
    }
    
    const result = await apiCall(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, role })
    });
    
    if (result !== null) {
        hideAddMemberForm(projectId);
        loadProjects();
        showSuccess('Member added successfully!');
    }
}

async function showProjectDetails(projectId) {
    const projectDetails = await apiCall(`/projects/${projectId}`);
    if (projectDetails) {
        const membersInfo = projectDetails.members ? 
            projectDetails.members.map(m => `${m.username} (${m.role})`).join(', ') : 
            'No members';
        
        alert(`Project: ${projectDetails.name}\nOwner: ${projectDetails.owner.username}\nMembers: ${membersInfo}`);
    }
}

// Drag and Drop functionality
function addDragAndDropListeners() {
    const kanbanTasks = document.querySelectorAll('.kanban-task');
    const kanbanColumns = document.querySelectorAll('.kanban-column');
    
    kanbanTasks.forEach(task => {
        task.addEventListener('dragstart', handleDragStart);
        task.addEventListener('dragend', handleDragEnd);
    });
    
    kanbanColumns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    if (e.target.classList.contains('kanban-column') || e.target.closest('.kanban-column')) {
        const column = e.target.classList.contains('kanban-column') ? e.target : e.target.closest('.kanban-column');
        column.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('kanban-column') || e.target.closest('.kanban-column')) {
        const column = e.target.classList.contains('kanban-column') ? e.target : e.target.closest('.kanban-column');
        column.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    const column = e.target.classList.contains('kanban-column') ? e.target : e.target.closest('.kanban-column');
    column.classList.remove('drag-over');
    
    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = column.dataset.status;
    
    if (taskId && newStatus) {
        await updateTaskStatus(parseInt(taskId), newStatus);
    }
}

// Task Modal functions
function openTaskModal(taskId) {
    currentTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    // Populate modal fields
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-description').value = task.description || '';
    document.getElementById('edit-task-priority').value = task.priority;
    document.getElementById('edit-task-status').value = task.status;
    
    // Set due date
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        document.getElementById('edit-task-due-date').value = localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById('edit-task-due-date').value = '';
    }
    
    // Load project members for assignment dropdown
    loadProjectMembersForEdit(task.project.id, task.assignedToUser?.id);
    
    // Show modal
    document.getElementById('task-modal').style.display = 'block';
}

function closeTaskModal() {
    document.getElementById('task-modal').style.display = 'none';
    currentTaskId = null;
}

async function loadProjectMembersForEdit(projectId, currentAssigneeId) {
    const projectDetails = await apiCall(`/projects/${projectId}`);
    const editAssignedSelect = document.getElementById('edit-task-assigned');
    
    if (projectDetails) {
        const members = [
            { id: projectDetails.owner.id, username: projectDetails.owner.username },
            ...(projectDetails.members || []).map(m => ({ id: m.id, username: m.username }))
        ];
        
        editAssignedSelect.innerHTML = '<option value="">Unassigned</option>' + 
            members.map(user => `<option value="${user.id}" ${user.id === currentAssigneeId ? 'selected' : ''}>${user.username}</option>`).join('');
    }
}

async function saveTaskChanges() {
    if (!currentTaskId) return;
    
    const taskData = {
        title: document.getElementById('edit-task-title').value,
        description: document.getElementById('edit-task-description').value,
        priority: document.getElementById('edit-task-priority').value,
        dueDate: document.getElementById('edit-task-due-date').value || null,
        assignedToUserId: document.getElementById('edit-task-assigned').value ? parseInt(document.getElementById('edit-task-assigned').value) : null
    };
    
    const result = await apiCall(`/tasks/${currentTaskId}`, {
        method: 'PUT',
        body: JSON.stringify(taskData)
    });
    
    if (result !== null) {
        // Update status separately if changed
        const newStatus = document.getElementById('edit-task-status').value;
        const currentTask = tasks.find(t => t.id === currentTaskId);
        
        if (currentTask && currentTask.status !== newStatus) {
            await updateTaskStatus(currentTaskId, newStatus);
        } else {
            await loadTasks();
        }
        
        closeTaskModal();
        showSuccess('Task updated successfully!');
    }
}

async function deleteTask() {
    if (!currentTaskId) return;
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    const result = await apiCall(`/tasks/${currentTaskId}`, {
        method: 'DELETE'
    });
    
    if (result !== null) {
        await loadTasks();
        closeTaskModal();
        showSuccess('Task deleted successfully!');
    }
}

// Utility functions
function showError(message) {
    // Remove existing error messages
    document.querySelectorAll('.error').forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = 'background: #c6f6d5; color: #38a169; padding: 1rem 1.5rem; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-left: 4px solid #38a169;';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.remove(), 3000);
}

// Global functions for onclick handlers
window.showAuthForm = showAuthForm;
window.showSection = showSection;
window.logout = logout;
window.updateTaskStatus = updateTaskStatus;
window.showAddMemberForm = showAddMemberForm;
window.hideAddMemberForm = hideAddMemberForm;
window.addMemberToProject = addMemberToProject;
window.showProjectDetails = showProjectDetails;

// Form submissions
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    const loginForm = document.getElementById('login-form-element');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            await login(email, password);
        });
    }

    // Register form
    const registerForm = document.getElementById('register-form-element');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            
            if (password.length < 6) {
                showError('Password must be at least 6 characters long');
                return;
            }
            
            await register(username, email, password);
        });
    }

    // Project form
    const projectForm = document.getElementById('project-form');
    if (projectForm) {
        projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const projectData = {
                name: document.getElementById('project-name').value,
                description: document.getElementById('project-description').value
                // ownerId is now set automatically from JWT token
            };
            
            const newProject = await apiCall('/projects', {
                method: 'POST',
                body: JSON.stringify(projectData)
            });
            
            if (newProject) {
                document.getElementById('project-form').reset();
                loadProjects();
                showSuccess('Project created successfully!');
            }
        });
    }

    // Task form
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const taskData = {
                title: document.getElementById('task-title').value,
                description: document.getElementById('task-description').value,
                projectId: parseInt(document.getElementById('task-project').value),
                assignedToUserId: document.getElementById('task-assigned').value ? parseInt(document.getElementById('task-assigned').value) : null,
                priority: document.getElementById('task-priority').value,
                dueDate: document.getElementById('task-due-date').value || null,
                status: 'ToDo'
                // createdByUserId is now set automatically from JWT token
            };
            
            const newTask = await apiCall('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            
            if (newTask) {
                document.getElementById('task-form').reset();
                loadTasks();
                showSuccess('Task created successfully!');
            }
        });
    }
    
    // Project dropdown change listener for task assignment
    const projectSelect = document.getElementById('task-project');
    if (projectSelect) {
        projectSelect.addEventListener('change', () => {
            loadUsersForTaskDropdowns();
        });
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = getAuthToken();
    const user = getCurrentUser();
    
    console.log('Checking stored auth:', { token: !!token, user: !!user }); // Debug log
    
    if (token && user) {
        currentUser = user;
        // Set the username immediately from stored data
        setCurrentUser(user);
        
        // Verify token is still valid by making a test API call
        apiCall('/users/me').then(result => {
            if (result) {
                // Token is valid, show authenticated view
                showAuthenticatedView();
            } else {
                // Token is invalid, clear storage and show login
                removeAuthToken();
                localStorage.removeItem('currentUser');
                showUnauthenticatedView();
            }
        });
    } else {
        showUnauthenticatedView();
    }
});