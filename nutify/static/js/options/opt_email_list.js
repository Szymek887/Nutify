// Email Configuration Module - List & Display Operations
// Handles listing and displaying email configurations:
// - Loading all email configurations
// - Rendering configurations in the UI
// - Testing email configurations by ID
// - Enabling/disabling configurations
// - Populating email dropdowns

// Function to load all email configurations
function loadAllEmailConfigs(options = {}) {
    // Default options
    const defaults = {
        hideForm: true,                // Whether to hide the email config form
        showAddContainer: true,        // Whether to show the add config container
        resetSummaryVisibility: true   // Whether to reset the summary visibility
    };
    
    // Merge options with defaults
    const settings = {...defaults, ...options};
    
    // Handle email configuration form visibility
    const emailConfigFormCard = document.getElementById('emailConfigFormCard');
    if (emailConfigFormCard && settings.hideForm) {
        emailConfigFormCard.style.display = 'none';
    }
    
    // Handle add configuration container visibility
    const addEmailConfigContainer = document.getElementById('addEmailConfigContainer');
    if (addEmailConfigContainer && settings.showAddContainer) {
        addEmailConfigContainer.style.display = 'block';
    }
    
    // Handle initial email config summary visibility
    const emailConfigSummary = document.getElementById('emailConfigSummary');
    if (emailConfigSummary && settings.resetSummaryVisibility) {
        emailConfigSummary.style.display = 'none';
    }
    
    // Hide notification settings section by default
    const notificationSettingsSection = document.getElementById('notification_settings_section');
    if (notificationSettingsSection) {
        notificationSettingsSection.style.display = 'none';
    }
    
    // Hide notification dependent sections by default
    const notificationDependentSections = document.getElementById('notification_dependent_sections');
    if (notificationDependentSections) {
        notificationDependentSections.style.display = 'none';
    }
    
    fetch('/api/settings/mail/all')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load email configurations');
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.success || !data.data) {
                // No configuration found
                return;
            }
            
            // Get the configurations array
            const configs = data.data;
            
            // Only render and show the summary if there's at least one valid configuration
            // A valid configuration must have a non-empty username
            const validConfigs = configs.filter(config => config.username && config.username.trim() !== '');
            
            if (validConfigs.length > 0) {
                renderEmailConfigs(validConfigs);
                
                // Show the email config summary
                if (emailConfigSummary) emailConfigSummary.style.display = 'block';
                
                // Show notification settings section if there are valid configurations
                if (notificationSettingsSection) {
                    notificationSettingsSection.style.display = 'block';
                }
                
                // Show notification dependent sections if there are valid configurations
                if (notificationDependentSections) {
                    notificationDependentSections.style.display = 'block';
                }
                
                // Update email dropdowns in notification settings
                populateEmailDropdowns();
            }
        })
        .catch(error => {
            console.error('Error loading email configurations:', error);
            showAlert('emailStatus', 'Failed to load email configurations', 'danger');
        });
}

// Function to render email configurations in the UI
function renderEmailConfigs(configs) {
    const emailConfigList = document.getElementById('emailConfigList');
    if (!emailConfigList) return;
    
    // Clear existing configurations
    emailConfigList.innerHTML = '';
    
    // Only proceed if we have valid configurations
    if (!configs || configs.length === 0) {
        // Hide the summary card if no valid configurations
        const emailConfigSummary = document.getElementById('emailConfigSummary');
        if (emailConfigSummary) emailConfigSummary.style.display = 'none';
        return;
    }
    
    // Render each configuration
    configs.forEach(config => {
        // Get provider display name
        let providerName = 'Custom';
        if (config.provider) {
            if (window.emailProviders && window.emailProviders[config.provider]) {
                // For standard providers, use their display name
                providerName = window.emailProviders[config.provider].displayName || config.provider;
            } else {
                // For custom providers, use the provider value directly (from Name Provider field)
                providerName = config.provider;
            }
        }
        
        // Create the configuration row
        const configRow = document.createElement('div');
        configRow.className = 'email_config_row';
        configRow.dataset.id = config.id;
        
        // Add default badge if this is the default configuration
        const defaultBadge = config.is_default ? 
            '<span class="default-badge"><i class="fas fa-check-circle"></i> Default</span>' : '';
        
        // Add status badge based on enabled status
        const statusClass = config.enabled ? 'status-enabled' : 'status-disabled';
        const statusText = config.enabled ? 'Enabled' : 'Disabled';
        const toggleBtnClass = config.enabled ? 'options_btn_primary' : 'options_btn_secondary';
        const toggleBtnText = config.enabled ? 'Disable' : 'Enable';
        
        configRow.innerHTML = `
            <div class="email_config_info">
                <div class="email_provider_info">
                    <i class="fas fa-plug"></i> <span>${providerName}</span>
                    ${defaultBadge}
                </div>
                <div class="email_address_info">
                    <i class="fas fa-at"></i> <span>${config.to_email || 'No recipient configured'}</span>
                </div>
                <div class="email_status_info ${statusClass}">
                    <i class="fas ${config.enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i> <span>${statusText}</span>
                </div>
            </div>
            <div class="email_config_actions">
                <button type="button" class="options_btn ${toggleBtnClass} toggle-config-enabled" data-config-id="${config.id}" data-enabled="${config.enabled}">
                    <i class="fas ${config.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${toggleBtnText}
                </button>
                <button type="button" class="options_btn options_btn_secondary edit-config-btn">
                    <i class="fas fa-cog"></i> Edit
                </button>
                <button type="button" class="options_btn options_btn_secondary delete-config-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        // Add event listeners
        const editBtn = configRow.querySelector('.edit-config-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => editEmailConfig(config.id));
        }
        
        const deleteBtn = configRow.querySelector('.delete-config-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this email configuration?')) {
                    deleteEmailConfig(config.id);
                }
            });
        }
        
        // Add event listener for enabled toggle button
        const enabledToggle = configRow.querySelector('.toggle-config-enabled');
        if (enabledToggle) {
            enabledToggle.addEventListener('click', function() {
                const configId = this.dataset.configId;
                const currentlyEnabled = this.dataset.enabled === 'true';
                const newEnabledState = !currentlyEnabled;
                
                updateEmailConfigEnabledStatus(configId, newEnabledState);
            });
        }
        
        // Add the row to the list
        emailConfigList.appendChild(configRow);
    });
    
    // Show the summary card
    const emailConfigSummary = document.getElementById('emailConfigSummary');
    if (emailConfigSummary) emailConfigSummary.style.display = 'block';
}

// Function to test email configuration by ID
function testEmailConfigById(configId) {
    if (!configId) {
        showAlert('emailStatus', 'No configuration selected for testing', 'danger');
        return;
    }
    
    // Update button state in the config card
    const card = document.querySelector(`.email-config-card[data-config-id="${configId}"]`);
    const button = card ? card.querySelector('.email-config-test') : null;
    
    if (button) {
        const originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    // Send the test request
    fetch(`/api/settings/mail/test/${configId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.notify('Test email sent successfully', 'success', 5000);
        } else {
            // Display the error message directly without prefixing with "Failed to send test email:"
            window.notify(data.message || 'Unknown error', 'error', 5000);
        }
    })
    .catch(error => {
        window.notify('Failed to send test email', 'error', 5000);
    })
    .finally(() => {
        // Restore button state
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    });
}

// Function to set default email configuration
function setDefaultEmailConfig(configId) {
    if (!configId) {
        showAlert('emailStatus', 'No configuration selected for default', 'danger');
        return;
    }
    
    fetch(`/api/settings/mail/default/${configId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('emailStatus', 'Default email configuration set successfully', 'success', true);
            loadAllEmailConfigs(); // Reload to update UI
        } else {
            showAlert('emailStatus', `Failed to set default email configuration: ${data.message || 'Unknown error'}`, 'danger', true);
        }
    })
    .catch(error => {
        showAlert('emailStatus', 'Failed to set default email configuration', 'danger', true);
    });
}

// Function to update email configuration enabled status
function updateEmailConfigEnabledStatus(configId, enabled) {
    if (!configId) return;
    
    // Immediately update the user interface
    const toggleBtn = document.querySelector(`.toggle-config-enabled[data-config-id="${configId}"]`);
    if (toggleBtn) {
        // Update button appearance
        toggleBtn.dataset.enabled = enabled.toString();
        toggleBtn.innerHTML = `<i class="fas ${enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${enabled ? 'Disable' : 'Enable'}`;
        toggleBtn.className = `options_btn ${enabled ? 'options_btn_primary' : 'options_btn_secondary'} toggle-config-enabled`;
        
        // Also update the displayed status
        const configRow = toggleBtn.closest('.email_config_row');
        if (configRow) {
            const statusInfo = configRow.querySelector('.email_status_info');
            if (statusInfo) {
                statusInfo.className = `email_status_info ${enabled ? 'status-enabled' : 'status-disabled'}`;
                statusInfo.innerHTML = `<i class="fas ${enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i> <span>${enabled ? 'Enabled' : 'Disabled'}</span>`;
            }
        }
    }
    
    // Create the update data
    const updateData = {
        id: configId,
        enabled: enabled,
        update_enabled_only: true
    };
    
    // Send the update request
    fetch('/api/settings/mail', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.notify(`Email configuration ${enabled ? 'enabled' : 'disabled'} successfully`, 'success', 5000);
            // Don't reload the full list to avoid flickering
            // loadAllEmailConfigs();
        } else {
            window.notify(`Failed to update configuration status: ${data.error || 'Unknown error'}`, 'error', 5000);
            // Restore the user interface in case of error
            if (toggleBtn) {
                // Restore button appearance
                toggleBtn.dataset.enabled = (!enabled).toString();
                toggleBtn.innerHTML = `<i class="fas ${!enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${!enabled ? 'Disable' : 'Enable'}`;
                toggleBtn.className = `options_btn ${!enabled ? 'options_btn_primary' : 'options_btn_secondary'} toggle-config-enabled`;
                
                // Also restore the displayed status
                const configRow = toggleBtn.closest('.email_config_row');
                if (configRow) {
                    const statusInfo = configRow.querySelector('.email_status_info');
                    if (statusInfo) {
                        statusInfo.className = `email_status_info ${!enabled ? 'status-enabled' : 'status-disabled'}`;
                        statusInfo.innerHTML = `<i class="fas ${!enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i> <span>${!enabled ? 'Enabled' : 'Disabled'}</span>`;
                    }
                }
            }
        }
    })
    .catch(error => {
        window.notify('Failed to update configuration status', 'error', 5000);
        // Restore the user interface in case of error
        if (toggleBtn) {
            toggleBtn.dataset.enabled = (!enabled).toString();
            toggleBtn.innerHTML = `<i class="fas ${!enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${!enabled ? 'Disable' : 'Enable'}`;
            toggleBtn.className = `options_btn ${!enabled ? 'options_btn_primary' : 'options_btn_secondary'} toggle-config-enabled`;
            
            const configRow = toggleBtn.closest('.email_config_row');
            if (configRow) {
                const statusInfo = configRow.querySelector('.email_status_info');
                if (statusInfo) {
                    statusInfo.className = `email_status_info ${!enabled ? 'status-enabled' : 'status-disabled'}`;
                    statusInfo.innerHTML = `<i class="fas ${!enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i> <span>${!enabled ? 'Enabled' : 'Disabled'}</span>`;
                }
            }
        }
    });
}

// Function to edit an email configuration
function editEmailConfig(configId) {
    // Show form and hide summary
    showEmailConfigForm();
    
    // Fetch the configuration data
    fetch(`/api/settings/mail/${configId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                showAlert('emailStatus', `Failed to load configuration: ${data.message || 'Unknown error'}`, 'danger');
                return;
            }
            
            const config = data.config;
            
            // Populate form fields
            document.getElementById('email_config_id').value = config.id;
            document.getElementById('smtp_server').value = config.smtp_server || '';
            document.getElementById('smtp_port').value = config.smtp_port || '';
            document.getElementById('smtp_username').value = config.username || '';
            document.getElementById('smtp_password').value = ''; // Password not returned for security
            document.getElementById('to_email').value = config.to_email || '';
            
            // Set the from_email field if it exists and is different from username
            const fromEmailField = document.getElementById('from_email');
            if (fromEmailField) {
                if (config.from_email && config.from_email !== config.username) {
                    fromEmailField.value = config.from_email;
                } else {
                    fromEmailField.value = '';
                }
            }
            
            // Set the provider
            const providerSelect = document.getElementById('email_provider');
            if (providerSelect) {
                providerSelect.value = config.provider || '';
                
                // If provider is not in the list, it might be a custom provider
                if (providerSelect.value !== config.provider && config.provider) {
                    providerSelect.value = '';
                    
                    // Set custom provider name
                    const customProviderNameField = document.getElementById('custom_provider_name');
                    if (customProviderNameField) {
                        customProviderNameField.value = config.provider;
                    }
                    
                    // Show custom provider field
                    const customProviderContainer = document.getElementById('custom_provider_container');
                    if (customProviderContainer) {
                        customProviderContainer.style.display = 'block';
                    }
                } else {
                    // Call the provider fields update function
                    window.updateProviderFields(config.provider);
                }
            }
            
            // Set TLS checkboxes
            const useTLS = document.getElementById('use_tls');
            const useSTARTTLS = document.getElementById('use_starttls');
            
            if (useTLS) useTLS.checked = config.tls === true;
            if (useSTARTTLS) useSTARTTLS.checked = config.tls_starttls === true;
            
            // Show save button immediately since we're editing
            const saveEmailConfigBtn = document.getElementById('saveEmailConfigBtn');
            if (saveEmailConfigBtn) saveEmailConfigBtn.style.display = 'inline-block';
        })
        .catch(error => {
            showAlert('emailStatus', 'Failed to load email configuration', 'danger');
        });
}

// Export functions for use in the main options page
window.loadAllEmailConfigs = loadAllEmailConfigs;
window.renderEmailConfigs = renderEmailConfigs;
window.testEmailConfigById = testEmailConfigById;
window.setDefaultEmailConfig = setDefaultEmailConfig;
window.updateEmailConfigEnabledStatus = updateEmailConfigEnabledStatus;
window.editEmailConfig = editEmailConfig; 