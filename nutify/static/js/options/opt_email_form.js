// Email Configuration Module - Form Operations
// Handles basic form functionality including:
// - Clearing form fields
// - Testing email from form
// - Updating email summary
// - Managing form visibility

// Function to clear form fields
function clearFormFields() {
    const emailForm = document.getElementById('emailConfigForm');
    if (!emailForm) return;

    const inputs = emailForm.querySelectorAll('input:not([type="submit"])');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    
    // Hide From Email field by default
    const fromEmailField = document.getElementById('from_email');
    if (fromEmailField) {
        fromEmailField.style.display = 'none';
        if (fromEmailField.parentElement) {
            fromEmailField.parentElement.style.display = 'none';
        }
    }
    
    // Explicitly clear the email_config_id field
    const emailConfigIdEl = document.getElementById('email_config_id');
    if (emailConfigIdEl) {
        emailConfigIdEl.value = '';
        // Also remove the attribute completely to ensure it's not sent
        emailConfigIdEl.removeAttribute('value');
    }
    
    // Reset provider selector
    const providerSelect = document.getElementById('email_provider');
    if (providerSelect) providerSelect.value = '';
    
    // Hide provider notes
    const providerNotes = document.getElementById('provider_notes');
    if (providerNotes) providerNotes.style.display = 'none';
    
    // Hide the Save Configuration button until a successful test
    const saveEmailConfigBtn = document.getElementById('saveEmailConfigBtn');
    if (saveEmailConfigBtn) saveEmailConfigBtn.style.display = 'none';
}

// Function to test email from the configuration form
function testEmailFromForm() {
    // Get form data
    const form = document.getElementById('emailConfigForm');
    const formData = new FormData(form);
    const config = {};
    
    // Process all form fields
    formData.forEach((value, key) => {
        // Skip the email_config_id field completely
        if (key === 'email_config_id') {
            return;
        }
        
        // Convert checkbox values from "on" to boolean
        if (key === 'use_tls' || key === 'use_starttls') {
            config[key] = value === 'on';
        } else {
            config[key] = value;
        }
    });
    
    // Manually add the provider since it's outside the form
    const provider = document.getElementById('email_provider').value;
    config.provider = provider;
    
    // If Custom Configuration is selected, use the custom provider name as provider value
    if (!provider) {
        const customProviderName = document.getElementById('custom_provider_name').value;
        if (customProviderName) {
            console.log("Using custom provider name for test:", customProviderName);
            config.provider = customProviderName;
        }
    }
    
    // Handle from_email - use explicit from_email if provided
    if (config.from_email && config.from_email.trim() !== '') {
        // Use the explicitly provided from_email
        console.log("Using provided from_email:", config.from_email);
    } else {
        // Fall back to username for from_email for backward compatibility
        config.from_email = config.smtp_username;
        console.log("Using username as from_email:", config.from_email);
    }
    
    // Ensure checkbox values are included (checkboxes aren't included in FormData when not checked)
    if (!formData.has('use_tls')) {
        config.use_tls = false;
    }
    
    if (!formData.has('use_starttls')) {
        config.use_starttls = false;
    }
    
    // Map form field names to API field names
    if (config.use_tls !== undefined) {
        config.tls = config.use_tls;
        delete config.use_tls;
    }
    
    if (config.use_starttls !== undefined) {
        config.tls_starttls = config.use_starttls;
        delete config.use_starttls;
    }
    
    // Validate required fields
    if (!config.smtp_server || !config.smtp_port || !config.smtp_username) {
        showAlert('emailStatus', 'Please fill in all required fields', 'danger');
        return;
    }
    
    // For Amazon SES, ensure from_email is provided and different from username
    if (provider === 'amazon' && (!config.from_email || config.from_email === config.smtp_username)) {
        showAlert('emailStatus', 'Amazon SES requires a valid sender email address in the From Email field', 'danger');
        return;
    }
    
    // Use the to_email field if provided, otherwise use the username
    const toEmail = config.to_email && config.to_email.trim() !== '' ? config.to_email : config.smtp_username;
    
    // Update button state
    const button = document.getElementById('testEmailBtn');
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    
    // Add the to_email to the config
    config.to_email = toEmail;
    
    // Create a sanitized copy for logging
    const logConfig = {...config};
    if (logConfig.password) {
        logConfig.password = '********';
    }
    
    // Send the test request
    fetch('/api/settings/mail/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.notify('Test email sent successfully', 'success', 5000);
            
            // Show the Save Configuration button after successful test
            const saveEmailConfigBtn = document.getElementById('saveEmailConfigBtn');
            if (saveEmailConfigBtn) saveEmailConfigBtn.style.display = 'inline-block';
        } else {
            // Display the error message directly without adding "Failed to send test email:" prefix
            window.notify(data.message || 'Unknown error', 'error', 5000);
        }
    })
    .catch(error => {
        window.notify('Failed to send test email', 'error', 5000);
    })
    .finally(() => {
        // Restore button state
        button.disabled = false;
        button.innerHTML = originalContent;
    });
}

// Function to update the email configuration summary
function updateEmailSummary(config) {
    const summaryProvider = document.getElementById('summary_provider');
    const summaryEmail = document.getElementById('summary_email');
    const emailConfigSummary = document.getElementById('emailConfigSummary');
    
    if (!config || !config.username) {
        emailConfigSummary.style.display = 'none';
        return;
    }
    
    emailConfigSummary.style.display = 'block';
    
    // Set provider name
    if (config.provider) {
        const providerSelect = document.getElementById('email_provider');
        const selectedOption = providerSelect.querySelector(`option[value="${config.provider}"]`);
        if (selectedOption) {
            summaryProvider.textContent = selectedOption.textContent;
        } else {
            // For custom providers, use the provider value directly instead of "Custom Configuration"
            summaryProvider.textContent = config.provider;
        }
    } else {
        summaryProvider.textContent = 'Custom Configuration';
    }
    
    // Set email address
    summaryEmail.textContent = config.username;
}

// Function to show the email configuration form
function showEmailConfigForm() {
    console.log("showEmailConfigForm called");
    
    // Hide email configs list and show the form
    const emailConfigForm = document.getElementById('emailConfigForm');
    const emailConfigsContainer = document.getElementById('emailConfigsContainer');
    const emailConfigListCard = document.getElementById('emailConfigListCard');
    const providerSelectorContainer = document.getElementById('providerSelectorContainer');
    const addEmailConfigContainer = document.getElementById('addEmailConfigContainer');
    const emailConfigFormCard = document.getElementById('emailConfigFormCard');
    
    // Update display properties
    if (emailConfigForm) emailConfigForm.style.display = 'block';
    if (emailConfigsContainer) emailConfigsContainer.style.display = 'none';
    if (emailConfigListCard) emailConfigListCard.style.display = 'none';
    if (providerSelectorContainer) providerSelectorContainer.style.display = 'none';
    if (addEmailConfigContainer) addEmailConfigContainer.style.display = 'none';
    if (emailConfigFormCard) emailConfigFormCard.style.display = 'block';
    
    // Enable form inputs
    document.querySelectorAll('.options_mail_form_group input, .options_mail_form_group select').forEach(input => {
        input.disabled = false;
    });
    
    console.log("Email Configuration form is now visible");
}

// Function to handle the Add Email Configuration button click
function handleAddEmailConfig() {
    console.log("handleAddEmailConfig called");
    
    // Hide form containers but keep the add button visible
    const emailConfigForm = document.getElementById('emailConfigForm');
    const addEmailConfigContainer = document.getElementById('addEmailConfigContainer');
    const emailConfigFormCard = document.getElementById('emailConfigFormCard');
    const emailConfigSummary = document.getElementById('emailConfigSummary');
    const configButtons = document.getElementById('configurationButtons');
    const configStatus = document.getElementById('configurationStatus');
    
    // Update display properties
    if (emailConfigForm) emailConfigForm.style.display = 'block';
    if (emailConfigSummary) emailConfigSummary.style.display = 'none';
    // Keep the add button container visible but hide the form card
    if (addEmailConfigContainer) addEmailConfigContainer.style.display = 'none';
    if (emailConfigFormCard) emailConfigFormCard.style.display = 'block';
    
    // Show configuration buttons
    if (configButtons) configButtons.classList.remove('hidden');
    if (configStatus) configStatus.classList.add('hidden');
    
    // Enable form inputs
    document.querySelectorAll('.options_mail_form_group input, .options_mail_form_group select').forEach(input => {
        input.disabled = false;
    });
    
    // Reset form fields
    clearFormFields();
    
    // Explicitly clear the email_config_id field to ensure we're adding a new configuration
    const emailConfigIdEl = document.getElementById('email_config_id');
    if (emailConfigIdEl) {
        emailConfigIdEl.value = '';
        // Also remove the attribute completely to ensure it's not sent
        emailConfigIdEl.removeAttribute('value');
    }
    
    // Check provider selection and show custom_provider_container if needed
    const providerSelect = document.getElementById('email_provider');
    if (providerSelect && providerSelect.value === '') {
        // When adding a new configuration, the default is "Custom Configuration" (empty value)
        // So we need to show the custom provider name field
        const customProviderContainer = document.getElementById('custom_provider_container');
        if (customProviderContainer) {
            customProviderContainer.style.display = 'block';
        }
    }
    
    console.log("Add Email Configuration form prepared");
}

// Funzione di compatibilità per aggiornare i campi in base al provider
function updateFormFieldsForProvider(provider) {
    console.log("updateFormFieldsForProvider (compatibility) called with:", provider);
    
    // Chiama la funzione principale se esiste
    if (typeof updateProviderFields === 'function') {
        updateProviderFields(provider);
    } else {
        console.error("updateProviderFields not available!");
        
        // Implementazione fallback basica
        if (!provider || provider === '') {
            // Reset fields for custom config
            document.getElementById('smtp_server').value = '';
            document.getElementById('smtp_port').value = '';
            document.getElementById('use_tls').checked = false;
            document.getElementById('use_starttls').checked = false;
            return;
        }
        
        // Tenta di caricare il provider dai dati globali
        const providers = window.emailProviders || {};
        const providerData = providers[provider];
        
        if (providerData) {
            // Update form fields with provider data
            document.getElementById('smtp_server').value = providerData.smtp_server || '';
            document.getElementById('smtp_port').value = providerData.smtp_port || '';
            document.getElementById('use_tls').checked = !!providerData.tls;
            document.getElementById('use_starttls').checked = !!providerData.tls_starttls;
        }
    }
}

// Function to handle the Cancel button in email configuration
function handleCancelEmailConfig() {
    // Hide the form
    const emailConfigFormCard = document.getElementById('emailConfigFormCard');
    if (emailConfigFormCard) emailConfigFormCard.style.display = 'none';
    
    // Show the add configuration container
    const addEmailConfigContainer = document.getElementById('addEmailConfigContainer');
    if (addEmailConfigContainer) addEmailConfigContainer.style.display = 'block';
    
    // Show the email configuration list
    const emailConfigSummary = document.getElementById('emailConfigSummary');
    if (emailConfigSummary) emailConfigSummary.style.display = 'block';
    
    // Ensure email configs container is visible if it exists
    const emailConfigsContainer = document.getElementById('emailConfigsContainer');
    if (emailConfigsContainer) emailConfigsContainer.style.display = 'block';
    
    // Ensure email config list card is visible if it exists
    const emailConfigListCard = document.getElementById('emailConfigListCard');
    if (emailConfigListCard) emailConfigListCard.style.display = 'block';
    
    // Clear form fields
    clearFormFields();
    
    // Reload all configs but tell the function NOT to reset the summary visibility
    if (typeof loadAllEmailConfigs === 'function') {
        loadAllEmailConfigs({
            hideForm: true,
            showAddContainer: true,
            resetSummaryVisibility: false // Don't hide the summary when loading configs
        });
    }
}

// Initialize cancel button when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const cancelEmailConfigBtn = document.getElementById('cancelEmailConfigBtn');
    if (cancelEmailConfigBtn) {
        cancelEmailConfigBtn.addEventListener('click', handleCancelEmailConfig);
    }
});

// Export functions for use in the main options page
window.clearFormFields = clearFormFields;
window.testEmailFromForm = testEmailFromForm;
window.updateEmailSummary = updateEmailSummary;
window.showEmailConfigForm = showEmailConfigForm;
window.handleAddEmailConfig = handleAddEmailConfig;
window.updateFormFieldsForProvider = updateFormFieldsForProvider;
window.handleCancelEmailConfig = handleCancelEmailConfig; 