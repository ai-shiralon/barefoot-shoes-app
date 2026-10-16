/**
 * doPost(e) - Webhook receiver for order submissions from barefoot-shoes-app
 * Appends each order to the "הזמנות" sheet.
 */
function doPost(e) {
  try {
    Logger.log("doPost called. e exists: " + (e !== undefined));

    if (!e || !e.postData) {
      Logger.log("Error: e or e.postData is undefined");
      Logger.log("e: " + e);
      Logger.log("e.postData: " + (e ? e.postData : "e is null"));
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Invalid request - missing postData" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Parse the incoming JSON payload
    const payload = JSON.parse(e.postData.contents);

    Logger.log("Received payload: " + JSON.stringify(payload));

    // Get the "הזמנות" sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("הזמנות");
    if (!sheet) {
      Logger.log("Sheet 'הזמנות' not found");
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Sheet 'הזמנות' not found" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log("Sheet found. Last row before append: " + sheet.getLastRow());

    // Append a row with the order data
    // Columns: id, createdAt, fullName, phoneNumber, city, address, email, totalPrice, items, paymentMethod, status, trackingNumber
    sheet.appendRow([
      payload.id || "",
      payload.createdAt || "",
      payload.fullName || "",
      payload.phoneNumber || "",
      payload.city || "",
      payload.address || "",
      payload.email || "",
      payload.totalPrice || "",
      payload.items || "",
      payload.paymentMethod || "",
      payload.status || "",
      payload.trackingNumber || ""
    ]);

    Logger.log("Row appended. Last row after append: " + sheet.getLastRow());

    // Return success response
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Order logged successfully", orderId: payload.id })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error: " + error.toString());
    // Return error response
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
