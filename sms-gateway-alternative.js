const axios = require('axios');

class SMSGateway {

  /**
   * Constructor for SMSGateway class
   * Initializes SMS gateway with required configuration
   * @constructor
   */
  constructor() {
    this.config = {
      baseUrl: 'https://3dvjnm.api.infobip.com',
      apiKey: '54d821dd2a75bacd6e4bdbe5a020579a-19a2298b-a8f8-44bb-a624-53268d4aa47e',
      senderName: 'Rdx Tta3limi',
      messagetype: 'TRANSACTIONAL'
    };
    
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `App ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ SMS Gateway initialized successfully');
  }

  // إرسال رسالة فردية - النسخة المُصلحة
  async sendIndividualSMS(to, message) {
    try {
      console.log(`📱 محاولة إرسال SMS إلى: ${to}`);
      console.log(`📝 نص الرسالة: ${message}`);
      
      // تحقق صارم من رقم الهاتف
      if (!to || typeof to !== 'string') {
        console.error('❌ رقم الهاتف غير صالح:', to);
        return { 
          success: false, 
          error: 'رقم الهاتف غير صالح' 
        };
      }
      
      // تنظيف الرقم
      let cleanNumber = to.trim();
      
      // إزالة كل شيء ما عدا الأرقام وعلامة +
      cleanNumber = cleanNumber.replace(/[^\d+]/g, '');
      
      // إذا لم يكن فيه +، أضف +213
      if (!cleanNumber.startsWith('+')) {
        if (cleanNumber.startsWith('0')) {
          cleanNumber = '+213' + cleanNumber.substring(1);
        } else if (cleanNumber.startsWith('213')) {
          cleanNumber = '+' + cleanNumber;
        } else {
          cleanNumber = '+213' + cleanNumber;
        }
      }
      
      // تأكد من الطول الصحيح
      if (cleanNumber.length < 12) {
        console.error('❌ رقم الهاتف قصير جداً:', cleanNumber);
        return { 
          success: false, 
          error: 'رقم الهاتف قصير جداً' 
        };
      }
      
      console.log(`📱 الرقم بعد التنظيف: ${cleanNumber}`);
      
      const payload = {
        messages: [
          {
            from: this.config.senderName,
            destinations: [{ to: cleanNumber }],
            text: message,
            messageType: this.config.messagetype  // Transactional
          }
        ]
      };
      

      console.log('📤 إرسال طلب إلى Infobip...');
      const response = await this.axiosInstance.post('/sms/2/text/advanced', payload);
      
      // تحقق صارم من الاستجابة
      const responseData = response.data;
      console.log('📥 استجابة Infobip:', JSON.stringify(responseData, null, 2));
      
      if (!responseData || !responseData.messages || responseData.messages.length === 0) {
        console.error('❌ استجابة Infobip غير صالحة:', responseData);
        return { 
          success: false, 
          error: 'استجابة غير صالحة من مزود الرسائل'
        };
      }
      
      const messageInfo = responseData.messages[0];
      
      if (!messageInfo.messageId) {
        console.error('❌ لا يوجد messageId في الاستجابة:', messageInfo);
        return { 
          success: false, 
          error: 'فشل في الحصول على معرف الرسالة'
        };
      }
      
      console.log(`✅ SMS أُرسل بنجاح! Message ID: ${messageInfo.messageId}`);
      console.log(`👤 إلى: ${cleanNumber}`);
      console.log(`📊 الحالة: ${messageInfo.status?.groupName || 'غير معروف'}`);
      
      return { 
        success: true, 
        response: responseData,
        messageId: messageInfo.messageId,
        status: messageInfo.status,
        to: cleanNumber
      };
      
    } catch (error) {
      console.error('❌ فشل إرسال SMS:', error.message);
      
      if (error.response) {
        // الخطأ من السيرفر
        console.error('📊 تفاصيل الخطأ:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
        
        return { 
          success: false, 
          error: `خطأ من السيرفر: ${error.response.status}`,
          details: error.response.data,
          statusCode: error.response.status
        };
        
      } else if (error.request) {
        // لا يوجد استجابة
        console.error('❌ لا يوجد استجابة من السيرفر');
        return { 
          success: false, 
          error: 'لا يوجد اتصال بخدمة الرسائل',
          details: 'فشل في الاتصال'
        };
        
      } else {
        // خطأ في الإعداد
        console.error('❌ خطأ في الإعداد:', error.message);
        return { 
          success: false, 
          error: `خطأ في الإعداد: ${error.message}`
        };
      }
    }
  }
}

module.exports = new SMSGateway();