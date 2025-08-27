const axios = require('axios');
const querystring = require('querystring');

class SMSGateway {
  constructor(config = {}) {
    this.config = {
      // Twilio Configuration
      twilio: {
        accountSid: config.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID,
        authToken: config.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN,
        fromNumber: config.TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER
      },
      
      // Nexmo/Vonage Configuration
      nexmo: {
        apiKey: config.NEXMO_API_KEY || process.env.NEXMO_API_KEY,
        apiSecret: config.NEXMO_API_SECRET || process.env.NEXMO_API_SECRET,
        from: config.NEXMO_FROM || process.env.NEXMO_FROM || 'TutoringCenter'
      },
      
      // TextBelt Configuration (Free tier available)
      textbelt: {
        apiKey: config.TEXTBELT_API_KEY || process.env.TEXTBELT_API_KEY || 'textbelt'
      },
      
      // Bulk SMS (Middle East focused)
      bulksms: {
        username: config.BULKSMS_USERNAME || process.env.BULKSMS_USERNAME,
        password: config.BULKSMS_PASSWORD || process.env.BULKSMS_PASSWORD
      },
      
      // Local/Custom Gateway Configuration
      custom: {
        apiUrl: config.CUSTOM_SMS_API_URL || process.env.CUSTOM_SMS_API_URL,
        apiKey: config.CUSTOM_SMS_API_KEY || process.env.CUSTOM_SMS_API_KEY,
        username: config.CUSTOM_SMS_USERNAME || process.env.CUSTOM_SMS_USERNAME,
        password: config.CUSTOM_SMS_PASSWORD || process.env.CUSTOM_SMS_PASSWORD
      },
      
      // Default provider
      defaultProvider: config.DEFAULT_SMS_PROVIDER || process.env.DEFAULT_SMS_PROVIDER || 'textbelt',
      
      // Rate limiting
      maxRetries: config.MAX_SMS_RETRIES || 3,
      retryDelay: config.SMS_RETRY_DELAY || 1000
    };
    
    this.rateLimiter = new Map(); // Simple rate limiting store
  }

  /**
   * Send SMS using the configured provider
   * @param {string} to - Phone number (international format recommended)
   * @param {string} message - Message content
   * @param {string} provider - Specific provider to use (optional)
   * @returns {Promise<Object>} Result object with success status and details
   */
  async send(to, message, provider = null) {
    const selectedProvider = provider || this.config.defaultProvider;
    
    // Basic validation
    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }

    // Format phone number
    const formattedPhone = this.formatPhoneNumber(to);
    
    // Check rate limiting
    if (this.isRateLimited(formattedPhone)) {
      throw new Error('Rate limit exceeded for this phone number');
    }

    // Apply rate limiting
    this.applyRateLimit(formattedPhone);

    try {
      let result;
      
      switch (selectedProvider.toLowerCase()) {
        case 'twilio':
          result = await this.sendViaTwilio(formattedPhone, message);
          break;
        case 'nexmo':
        case 'vonage':
          result = await this.sendViaNexmo(formattedPhone, message);
          break;
        case 'textbelt':
          result = await this.sendViaTextBelt(formattedPhone, message);
          break;
        case 'bulksms':
          result = await this.sendViaBulkSMS(formattedPhone, message);
          break;
        case 'custom':
          result = await this.sendViaCustomGateway(formattedPhone, message);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${selectedProvider}`);
      }

      return {
        success: true,
        provider: selectedProvider,
        to: formattedPhone,
        message: message,
        ...result
      };
    } catch (error) {
      console.error(`SMS sending failed via ${selectedProvider}:`, error.message);
      
      // Try fallback providers if primary fails
      if (!provider) { // Only use fallback if no specific provider was requested
        return await this.sendWithFallback(formattedPhone, message, selectedProvider);
      }
      
      throw error;
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendViaTwilio(to, message) {
    if (!this.config.twilio.accountSid || !this.config.twilio.authToken) {
      throw new Error('Twilio credentials not configured');
    }

    const auth = Buffer.from(`${this.config.twilio.accountSid}:${this.config.twilio.authToken}`).toString('base64');
    
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilio.accountSid}/Messages.json`,
      querystring.stringify({
        From: this.config.twilio.fromNumber,
        To: to,
        Body: message
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return {
      messageId: response.data.sid,
      status: response.data.status,
      cost: response.data.price
    };
  }

  /**
   * Send SMS via Nexmo/Vonage
   */
  async sendViaNexmo(to, message) {
    if (!this.config.nexmo.apiKey || !this.config.nexmo.apiSecret) {
      throw new Error('Nexmo credentials not configured');
    }

    const response = await axios.post('https://rest.nexmo.com/sms/json', {
      api_key: this.config.nexmo.apiKey,
      api_secret: this.config.nexmo.apiSecret,
      from: this.config.nexmo.from,
      to: to.replace('+', ''),
      text: message
    });

    if (response.data.messages[0].status !== '0') {
      throw new Error(`Nexmo error: ${response.data.messages[0]['error-text']}`);
    }

    return {
      messageId: response.data.messages[0]['message-id'],
      status: 'sent',
      cost: response.data.messages[0]['message-price']
    };
  }

  /**
   * Send SMS via TextBelt (good for testing)
   */
  async sendViaTextBelt(to, message) {
    const response = await axios.post('https://textbelt.com/text', {
      phone: to,
      message: message,
      key: this.config.textbelt.apiKey
    });

    if (!response.data.success) {
      throw new Error(`TextBelt error: ${response.data.error}`);
    }

    return {
      messageId: response.data.textId,
      status: 'sent',
      quotaRemaining: response.data.quotaRemaining
    };
  }

  /**
   * Send SMS via BulkSMS (good for Middle East/Africa)
   */
  async sendViaBulkSMS(to, message) {
    if (!this.config.bulksms.username || !this.config.bulksms.password) {
      throw new Error('BulkSMS credentials not configured');
    }

    const auth = Buffer.from(`${this.config.bulksms.username}:${this.config.bulksms.password}`).toString('base64');
    
    const response = await axios.post('https://api.bulksms.com/v1/messages', {
      to: to,
      body: message
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      messageId: response.data.id,
      status: 'sent'
    };
  }

  /**
   * Send SMS via custom gateway
   */
  async sendViaCustomGateway(to, message) {
    if (!this.config.custom.apiUrl) {
      throw new Error('Custom SMS gateway URL not configured');
    }

    const requestData = {
      to: to,
      message: message,
      from: 'TutoringCenter'
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    // Add authentication based on available config
    if (this.config.custom.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.custom.apiKey}`;
    } else if (this.config.custom.username && this.config.custom.password) {
      const auth = Buffer.from(`${this.config.custom.username}:${this.config.custom.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await axios.post(this.config.custom.apiUrl, requestData, { headers });

    return {
      messageId: response.data.id || response.data.messageId || Date.now().toString(),
      status: 'sent',
      response: response.data
    };
  }

  /**
   * Try fallback providers if primary fails
   */
  async sendWithFallback(to, message, failedProvider) {
    const providers = ['twilio', 'nexmo', 'textbelt', 'bulksms', 'custom'];
    const remainingProviders = providers.filter(p => p !== failedProvider);

    for (const provider of remainingProviders) {
      try {
        console.log(`Trying fallback provider: ${provider}`);
        return await this.send(to, message, provider);
      } catch (error) {
        console.error(`Fallback provider ${provider} failed:`, error.message);
        continue;
      }
    }

    throw new Error('All SMS providers failed');
  }

  /**
   * Send bulk SMS to multiple recipients
   */
  async sendBulk(recipients, message, provider = null) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming APIs
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(async (recipient) => {
        try {
          const result = await this.send(recipient, message, provider);
          return { recipient, success: true, result };
        } catch (error) {
          return { recipient, success: false, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.value || r.reason));
      
      // Add delay between batches
      if (i + batchSize < recipients.length) {
        await this.delay(this.config.retryDelay);
      }
    }

    return {
      total: recipients.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phone) {
    // Remove any non-digit characters except +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it needs country code
    if (!formatted.startsWith('+')) {
      // Default to Algeria country code (+213) - adjust as needed
      if (formatted.startsWith('0')) {
        formatted = '+213' + formatted.substring(1);
      } else if (formatted.length === 9) {
        formatted = '+213' + formatted;
      } else {
        formatted = '+' + formatted;
      }
    }
    
    return formatted;
  }

  /**
   * Simple rate limiting
   */
  isRateLimited(phone) {
    const now = Date.now();
    const limit = this.rateLimiter.get(phone);
    
    if (!limit) return false;
    
    // Allow 1 SMS per minute per number
    return (now - limit.lastSent) < 60000 && limit.count >= 1;
  }

  applyRateLimit(phone) {
    const now = Date.now();
    const existing = this.rateLimiter.get(phone);
    
    if (!existing || (now - existing.lastSent) > 60000) {
      this.rateLimiter.set(phone, { lastSent: now, count: 1 });
    } else {
      existing.count++;
      existing.lastSent = now;
    }
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate message content
   */
  validateMessage(message) {
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }
    
    if (message.length > 1600) {
      throw new Error('Message too long (max 1600 characters)');
    }
    
    return message.trim();
  }

  /**
   * Get delivery status (if supported by provider)
   */
  async getDeliveryStatus(messageId, provider = null) {
    const selectedProvider = provider || this.config.defaultProvider;
    
    try {
      switch (selectedProvider.toLowerCase()) {
        case 'twilio':
          return await this.getTwilioStatus(messageId);
        case 'nexmo':
          return await this.getNexmoStatus(messageId);
        default:
          return { status: 'unknown', message: 'Status check not supported for this provider' };
      }
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async getTwilioStatus(messageId) {
    const auth = Buffer.from(`${this.config.twilio.accountSid}:${this.config.twilio.authToken}`).toString('base64');
    
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilio.accountSid}/Messages/${messageId}.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    return {
      status: response.data.status,
      errorCode: response.data.error_code,
      errorMessage: response.data.error_message
    };
  }

  async getNexmoStatus(messageId) {
    const response = await axios.get(`https://rest.nexmo.com/search/message`, {
      params: {
        api_key: this.config.nexmo.apiKey,
        api_secret: this.config.nexmo.apiSecret,
        id: messageId
      }
    });

    return {
      status: response.data.status,
      network: response.data.network
    };
  }
}

// Export singleton instance
const smsGateway = new SMSGateway();

module.exports = smsGateway;

// Also export the class for custom instances
module.exports.SMSGateway = SMSGateway;