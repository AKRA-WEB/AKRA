/**
 * GitHub Repo: https://github.com/AKRA-WEB/AKRA
 * โปรเจกต์: ระบบบริหารจัดการคลังสินค้า W5 (ตึกเทา)
 */
/**
 * โปรเจกต์: ระบบบริหารจัดการคลังสินค้า W5 (ตึกเทา)
 * ฟีเจอร์: เบิก-รับ, ใบจัดสินค้า (Pick List), แจ้งเตือน LINE Messaging API
 */

// ====== ตั้งค่า Google Sheets ID ของคุณ ======
const SHEET_ID = '1tsSTyqpuJM2RL5GWek8-8fU3ghyLOqV8x3Zfu5ckirQ';
const SHEET_NAME = 'W5';
const HISTORY_SHEET_NAME = 'History'; 
const PICKLIST_SHEET_NAME = 'PickList'; 
// =======================================

const initialProducts = [
  "^Z/S) ถ้วยทาร์ตโปรตุเกส โอคุน #206 (ลัง11x60x9.5g)", "^Z/ครีมเมอร์ Rich's กล่องฟ้า (ลัง24x454g)", "^Z/ถ้วยทาร์ตโปรตุเกส โอคุน #207 (ลัง10x40x20g)", "^Z/น้ำทาร์ต พรีมีโอ ทาร์ตฟิลลิ่ง (ลัง12x907g)", "^Z/บลูเบอร์รี่ แช่แข็ง ถุงเปลือย (ลัง10x1kg)", "^Z/มอสเซเรล่าชีส แบบขูด Valla (ลัง12x1kg)", "^Z/วิปปิ้ง วิปอีโค่ EcoWhip RICH (ลัง12x907g)", "^Z/วิปปิ้งครีม Rich's โกลด์ (ลัง12x907g)", "^Z/วิปปิ้งครีม Rich's ซันวิป (ลัง12x1kg)", "^Z/วิปปิ้งครีม Rich's เบเกอรี่ท็อปปิ้ง[ฟ้า] (ลัง12x1kg)", "^Z/วิปปิ้งครีม ไชน์โร้ด Gold กล่องฟ้า (ลัง12x1kg)", "^Z/วิปปิ้งครีม ท้อปปิ้ง Rich's แวลู (ลัง12x1kg)", "^Z/วิปปิ้งครีม ลายวัว มิลค์ ท็อปปิ้ง Niagara (ลัง12x907g)", "^Z/วิปปิ้งครีม วีโว่ (ลัง12x1.1kg)", "^Z/วิปปิ้งครีม สำหรับขนมปัง Rich's Avoset (ลัง12x1kg)", "^Z/สตรอเบอร์รี่ แช่แข็ง Castella เกรดA (ลัง10x1kg)", "Y/L)แป้ง โก๋ ฉลาม (กระสอบ 30kg)", "Y/L)แป้ง ข้าวโพด ProCorn (กระสอบ 25kg)", "Y/L)แป้ง ดาวฟ้า (กระสอบ5x5kg)", "Y/S)แป้ง ว่าว (กระสอบ 22.5kg)", "Y/ข]เนยเทียม เซสท์ ขาว ตัก (ลัง15kg)", "Y/เบกกิ้งโซดา (กระสอบ25kg)", "Y/ย]เนยเทียม หยก เหลือง ตัก (ลัง15kg)", "Y/ล]เนยเทียม เซสท์ เหลือง ตัก (ลัง15kg)", "Y/สารกันบูด แบบเนื้อทราย Purox's (กระสอบ25kg)", "Y/สารกันบูด แบบผงละเอียด (กระสอบ25kg)", "Y/หัวนมผง 'ฉลาม' สำหรับเบเกอร์รี่ (กระสอบ25kg)", "Z/F]เนยทอด ฟราย ฟราย (ลัง15x1kg)", "Z/L)แป้ง ข้าวโพด ProCorn (ลัง10x1kg)", "Z/L)ผงฟู ดับเบิ้ลแอ้ดชั่น เบสท์โอเดอร์ @1kg (ลัง12x1kg)", "Z/S)ผงฟูซอง ซิงเกิลแอ้คชั่น เบสท์โอเดอร์", "Z/เกล็ดขนมปัง ซุปเปอร์ไฟน์ (ลัง10x1kg)", "Z/ครีมเทียม คอฟฟี่ ดรีมเมอร์ Dreamer (แดง) (ลัง12x1kg)", "Z/นมข้นจืด พาเลซ แดง (ถาด48กป.)", "Z/น้ำตาลเบเกอร์รี่ Caster มิตรผล (ลัง24x1kg)", "Z/น้ำตาลไอซิ่ง มิตรผล (ลัง12x900g)", "Z/แป้ง ดาวฟ้า (ลัง10x1kg)", "Z/แป้ง มันสำปะหลัง ปลาไทย (กระสอบ40x500g)", "Z/แป้ง ห่าน-หงส์ (ลัง10x1kg)", "Z/ผงโกโก้ สีเข้ม CocoaRich (ลัง24x500g)", "Z/ผงคัสตาร์ด Royal (ลัง24x300g)", "Z/หัวนมผง 'ฉลาม' สำหรับเบเกอร์รี่ (ลัง25x1kg)", "Z/หัวนมผงนิวซีแลนด์ แท้100% Dairy-Rich (ลัง12x1kg)", "กิเลนแดง (กระสอบ 22.5kg)", "กิเลนเหลือง (กระสอบ 22.5kg)", "ข้าวเจ้า หมีคู่ดาว (กระสอบ 10x1kg)", "ครีมเทียม คอฟฟี่ ดรีมมี่ Dreamy (ฟ้า) (ลัง12x1kg)", "ซอสพริก โรซ่า (ลัง12x1kg)", "ซอสมะเขือเทศ โรซ่า (ลัง12x1kg)", "ถ้วยฟอยล์ พร้อมอบ Star *แยกฝา* (ลัง12x50pcs) - 3282G(3007)", "ถุงตรานกแก้ว 10x15", "นมข้นจืด ฟอลค่อน Extra เอ้กตร้า (ลัง12x1kg)", "นมข้นจืดกล่อง พาเลซ แดง (ลัง12x1L)", "นมข้นหวาน ซันเบิร์ด (ลัง8x2kg)", "นมข้นหวาน พาเลซ กระป๋อง (ถาด48x350g)", "นมข้นหวานถุง พาเลซ (ลัง8x2kg)", "น้ำตาลทราย คาราเมล มิตรผลโกลด์ (ลัง20x1kg)", "น้ำตาลทรายแดง เบเกอร์รี่ มิตรผล (ลัง20x1kg)", "แป้ง ว่าว (ลัง10x1kg)", "ห่าน(กระสอบ 22.5kg)", "กิเลนเหลือง (ลัง10x1kg)", "เนยเทียม ป๊อบ แพ็ค (ลัง15x1kg)"
];

/**
 * ฟังก์ชันส่งแจ้งเตือนผ่าน LINE Messaging API
 */
function sendLineMessage(itemName, quantity, withdrawer, unit) {
  const CHANNEL_ACCESS_TOKEN = "PjS0VKY0nWYKRa5hgDtaeG4+v9OsOWnL8EWf/Sy7uREbQedU9faxBsfnIk/USoeHR2oo/Td2uZre6KKMZoJprXaMPO9S+32/4kygylwbJA37jLctHhXxdyYXKarDuyxXHFlA+5CuWAHVNjH2JALvEgdB04t89/1O/w1cDnyilFU="; 
  const DESTINATION_ID = "C37eb769aeeb97c3a3ca2b1b06b1576c6"; 
  
  const messageText = "📦 [Tranfer W5] มีการเบิกสินค้าออก!\n" +
                    "▶ รายการ: " + itemName + "\n" +
                    "▶ จำนวน: " + quantity + " " + (unit || "หน่วย") + "\n" +
                    "▶ ผู้เบิก: " + withdrawer;

  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    "to": DESTINATION_ID,
    "messages": [{ "type": "text", "text": messageText }]
  };
  
  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true 
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const resCode = response.getResponseCode();
    if (resCode !== 200) {
       console.error("❌ Error LINE API (Code " + resCode + "): " + response.getContentText());
    } else {
       console.log("✅ ส่งแจ้งเตือน LINE สำเร็จ");
    }
  } catch (error) {
    console.error("❌ Exception: " + error.toString());
  }
}

/**
 * ฟังก์ชันสำหรับทดสอบสิทธิ์ (Authorize)
 */
function testSendLine() {
  sendLineMessage("ทดสอบระบบแจ้งเตือน", 1, "แอดมิน", "ชิ้น");
}

/**
 * รันครั้งแรกเพื่อเตรียมโครงสร้างชีต
 */
function setupEnvironment() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. ชีตสินค้าหลัก W5
  let w5 = ss.getSheetByName(SHEET_NAME);
  if(!w5) {
    w5 = ss.insertSheet(SHEET_NAME);
    w5.appendRow(['ID', 'Name', 'Stock', 'Unit']);
    w5.getRange("A1:D1").setFontWeight("bold").setBackground("#d9ead3");
    const dataToInsert = initialProducts.map((name, index) => [index + 1, name, 0, 'ชิ้น']);
    if(dataToInsert.length > 0) w5.getRange(2, 1, dataToInsert.length, 4).setValues(dataToInsert);
  }

  // 2. ชีตประวัติ History
  let hist = ss.getSheetByName(HISTORY_SHEET_NAME);
  if(!hist) {
    hist = ss.insertSheet(HISTORY_SHEET_NAME);
    hist.appendRow(['Date', 'Time', 'Type', 'ProductName', 'Qty', 'User']);
    hist.getRange("A1:F1").setFontWeight("bold").setBackground("#cfe2f3");
  }

  // 3. ชีตใบจัด PickList
  let pl = ss.getSheetByName(PICKLIST_SHEET_NAME);
  if(!pl) {
    pl = ss.insertSheet(PICKLIST_SHEET_NAME);
    pl.appendRow(['PickID', 'ProductID', 'ProductName', 'Qty', 'RequestedBy', 'TimeStr']);
    pl.getRange("A1:F1").setFontWeight("bold").setBackground("#fff2cc");
  }
}

/**
 * โหลดข้อมูลส่งไปหน้าบ้าน (index.html)
 */
function doGet(e) {
  if(e.parameter.action === 'getData') {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const w5 = ss.getSheetByName(SHEET_NAME);
    const hist = ss.getSheetByName(HISTORY_SHEET_NAME);
    const pl = ss.getSheetByName(PICKLIST_SHEET_NAME);

    // ดึงข้อมูลสินค้าและหน่วย
    const productsData = w5.getDataRange().getValues();
    const products = [];
    for(let i=1; i<productsData.length; i++) {
      if(productsData[i][0]) products.push({ 
        id: parseInt(productsData[i][0]), 
        name: productsData[i][1], 
        stock: parseInt(productsData[i][2]) || 0,
        unit: productsData[i][3] || 'ชิ้น'
      });
    }

    // ดึงประวัติ 150 รายการล่าสุด
    const historyData = hist.getDataRange().getValues();
    const history = [];
    const startIndex = Math.max(1, historyData.length - 150); 
    for(let i = startIndex; i < historyData.length; i++) {
      if(historyData[i][0]) {
        if (historyData[i][1] === 'in' || historyData[i][1] === 'out') {
          history.push({ date: historyData[i][0], time: '', type: historyData[i][1], productName: historyData[i][2], qty: historyData[i][3], user: historyData[i][4] });
        } else {
          let d = historyData[i][0];
          let t = historyData[i][1];
          let dStr = (d instanceof Date) ? Utilities.formatDate(d, "Asia/Bangkok", "dd/MM/yy") : d;
          let tStr = (t instanceof Date) ? Utilities.formatDate(t, "Asia/Bangkok", "HH:mm:ss") : t;
          history.push({ date: dStr, time: tStr, type: historyData[i][2], productName: historyData[i][3], qty: historyData[i][4], user: historyData[i][5] });
        }
      }
    }

    // ดึงรายการใบจัด
    const pickList = [];
    if(pl) {
      const plData = pl.getDataRange().getValues();
      for(let i=1; i<plData.length; i++) {
        if(plData[i][0]) {
          pickList.push({
            pickId: plData[i][0].toString(),
            productId: parseInt(plData[i][1]),
            productName: plData[i][2],
            qty: parseInt(plData[i][3]),
            requestedBy: plData[i][4],
            timeStr: plData[i][5]
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({products, history, pickList})).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * รับคำสั่งจากหน้าบ้านเพื่ออัปเดตข้อมูล
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); 

  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let result = { success: false };

    const w5 = ss.getSheetByName(SHEET_NAME);
    const hist = ss.getSheetByName(HISTORY_SHEET_NAME);
    const pl = ss.getSheetByName(PICKLIST_SHEET_NAME);

    // 1. รายการด่วน (เบิก-รับ ทันที)
    if(data.action === 'transaction') {
      const productsData = w5.getDataRange().getValues();
      let rowIndex = -1;
      let currentStock = 0;
      let unitStr = 'ชิ้น';
      
      for(let i=1; i<productsData.length; i++) {
        if(productsData[i][0] == data.productId) { 
          rowIndex = i + 1; 
          currentStock = parseInt(productsData[i][2]) || 0; 
          unitStr = productsData[i][3] || 'ชิ้น';
          break; 
        }
      }

      if(rowIndex > -1) {
        let newStock = data.type === 'in' ? currentStock + data.qty : currentStock - data.qty;
        w5.getRange(rowIndex, 3).setValue(newStock);
        
        let now = new Date();
        let dateStr = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yy");
        let timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
        
        hist.appendRow([dateStr, timeStr, data.type, data.productName, data.qty, data.user]);
        
        // แจ้งเตือนไลน์เมื่อมีการเบิกออก
        if (data.type === 'out' && !data.productName.includes('[ยกเลิก]')) {
          sendLineMessage(data.productName, data.qty, data.user, unitStr);
        }
        result = { success: true, newStock: newStock };
      }
    } 
    // 2. เพิ่มลงใบจัด
    else if (data.action === 'addPickList') {
      pl.appendRow([data.pickId, data.productId, data.productName, data.qty, data.requestedBy, data.timeStr]);
      result = { success: true };
    } 
    // 3. ยืนยันการหยิบตามใบจัด
    else if (data.action === 'processPickList' || data.action === 'removePickList') {
      const plData = pl.getDataRange().getValues();
      for(let i=1; i<plData.length; i++) {
        if(plData[i][0].toString() === data.pickId.toString()) {
          pl.deleteRow(i + 1);
          break;
        }
      }

      if (data.action === 'processPickList') {
        const productsData = w5.getDataRange().getValues();
        let rowIndex = -1;
        let currentStock = 0;
        let unitStr = 'ชิ้น';
        
        for(let i=1; i<productsData.length; i++) {
          if(productsData[i][0] == data.productId) { 
            rowIndex = i + 1; currentStock = parseInt(productsData[i][2]) || 0; unitStr = productsData[i][3] || 'ชิ้น'; break; 
          }
        }

        if(rowIndex > -1) {
          let actualQty = parseInt(data.actualQty) || 0;
          let newStock = currentStock - actualQty;
          w5.getRange(rowIndex, 3).setValue(newStock);
          
          let now = new Date();
          let dateStr = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yy");
          let timeStr = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
          
          hist.appendRow([dateStr, timeStr, 'out', data.productName, actualQty, data.pickerUser]);
          sendLineMessage(data.productName, actualQty, data.pickerUser, unitStr);
          result = { success: true, newStock: newStock };
        }
      } else {
        result = { success: true }; 
      }
    }
    // 4. จัดการรายการสินค้า
    else if (data.action === 'addProduct') {
      w5.appendRow([data.product.id, data.product.name, data.product.stock, data.product.unit || 'ชิ้น']);
      result = { success: true };
    } else if (data.action === 'deleteProduct') {
      const productsData = w5.getDataRange().getValues();
      for(let i=1; i<productsData.length; i++) {
        if(productsData[i][0] == data.productId) { w5.deleteRow(i + 1); break; }
      }
      result = { success: true };
    } else if (data.action === 'editProduct') {
      const productsData = w5.getDataRange().getValues();
      for(let i=1; i<productsData.length; i++) {
        if(productsData[i][0] == data.productId) { w5.getRange(i + 1, 2).setValue(data.newName); break; }
      }
      result = { success: true };
    }

    return ContentService.createTextOutput(JSON.stringify(result));

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}));
  } finally {
    lock.releaseLock();
  }
}