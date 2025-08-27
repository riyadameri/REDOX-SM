#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN 9
#define SS_PIN 10

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  while (!Serial);
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("RFID Reader Ready");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  Serial.print("UID:");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
  }
  Serial.println();
  
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(1000);
}










#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN 9
#define SS_PIN 10  // يجب أن يتصل هذا بالرجل SDA في القارئ

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  while (!Serial);
  SPI.begin();          // تهيئة بروتوكول SPI
  mfrc522.PCD_Init();   // تهيئة القارئ
  Serial.println("RFID Reader Ready");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  Serial.print("UID:");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
  }
  Serial.println();
  
  mfrc522.PICC_HaltA();        // إيقاف البطاقة
  mfrc522.PCD_StopCrypto1();   // إيقاف التشفير
  delay(1000);                 // تأخير بسيط
}



sudo usermod -a -G dialout $USER
sudo chmod a+rw /dev/ttyACM0
