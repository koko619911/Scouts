const express = require("express");
const { db } = require("../firebaseAdmin"); // Ensure this is the Firestore instance
const PDFDocument = require("pdfkit");  // Import PDFKit
const path = require("path");

const router = express.Router();

// Helper function to get the start of the week (Friday to Friday)
function getWeekStart(dateString) {
  const date = new Date(dateString);
  const day = date.getDay(); // Sunday = 0, Friday = 5
  const diff = day >= 5 ? day - 5 : 7 - (5 - day); // How many days to subtract
  date.setDate(date.getDate() - diff);
  return date.toISOString().split("T")[0];
}

// Submit note data
router.post("/submit", async (req, res) => {
    const { userId, date, notes, points } = req.body;
  
    if (!userId || !date || !Array.isArray(notes) || typeof points !== "number") {
      return res.status(400).json({ error: "Invalid input" });
    }
  
    try {
      const weekStart = getWeekStart(date);
      const noteRef = db.collection("Note").doc(userId).collection("Note").doc(date);
      const doc = await noteRef.get();
  
      if (doc.exists) {
        return res.json({ success: false, error: "Already submitted" });
      }
  
      // Check for weekly notes duplication
      const weeklyNotes = ["التناول", "مدارس الاحد", "الشمامسة/الشماسات", "اعداد الخدام /فصل تعليمي"];
      const weekNotesRef = db.collection("Note").doc(userId).collection("Note");
      const weekQuery = await weekNotesRef
        .where("timestamp", ">=", new Date(weekStart))
        .get();
  
      const allWeekNotes = weekQuery.docs.map(doc => doc.data().notes).flat();
      const duplicate = notes.find(note => weeklyNotes.includes(note) && allWeekNotes.includes(note));
  
      if (duplicate) {
        return res.json({
          success: false,
          error: `You already submitted the weekly activity: ${duplicate}`,
        });
      }
  
      // ✅ Save note entry
      await noteRef.set({
        notes,
        timestamp: new Date(),
        points,
      });
  
      // ✅ Update user total points
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
  
      if (userDoc.exists) {
        const currentPoints = userDoc.data().points || 0;
        await userRef.update({
          points: currentPoints + points,
          lastNoteDate: date,
        });
      }
  
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
});

// Check if note already submitted today
router.get("/check", async (req, res) => {
  const { userId, date } = req.query;

  if (!userId || !date) {
    return res.status(400).json({ error: "Missing userId or date" });
  }

  try {
    const noteRef = db
      .collection("Note")
      .doc(userId)
      .collection("Note")
      .doc(date);
    const doc = await noteRef.get();
    res.json({ exists: doc.exists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get weekly notes for the user (week starting from Friday)
router.get("/week", async (req, res) => {
  const { userId, weekStart } = req.query;

  if (!userId || !weekStart) {
    return res.status(400).json({ error: "Missing userId or weekStart" });
  }

  try {
    // Convert weekStart to Date object
    const startOfWeek = new Date(weekStart);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7); // Set end of the week (next Friday)

    // Query the Firestore collection for notes submitted this week
    const weekNotesRef = db.collection("Note").doc(userId).collection("Note");
    const querySnapshot = await weekNotesRef
      .where("timestamp", ">=", startOfWeek)
      .where("timestamp", "<", endOfWeek)
      .get();

    const notes = querySnapshot.docs.map((doc) => doc.data().notes).flat();
    res.json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Generate PDF for weekly notes
router.get("/week-pdf", async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  // Validate inputs
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Convert dates to UTC
    const startUTC = new Date(startDate);
    const endUTC = new Date(endDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    endUTC.setUTCHours(23, 59, 59, 999);

    // Get documents from Firestore
    const notesRef = db.collection("Note").doc(userId).collection("Note");
    const snapshot = await notesRef
      .where("timestamp", ">=", startUTC)
      .where("timestamp", "<=", endUTC)
      .orderBy("timestamp", "asc")
      .get();

    // Create PDF document
    const pdfDoc = new PDFDocument();
    
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=weekly-notes-${userId}.pdf`);
    
    // Pipe PDF to response
    pdfDoc.pipe(res);

    // Load Arabic font
    const fontPath = path.join(__dirname, 'Cairo-VariableFont_slnt,wght.ttf');
    pdfDoc.registerFont('arabic', fontPath); // Fixed variable name here

    // PDF content
    pdfDoc.font('arabic')
       .fontSize(16)
       .text('الملاحظات الأسبوعية', { align: 'right' })
       .moveDown(0.5);

    // Add date range
    pdfDoc.fontSize(12)
       .text(`من ${new Date(startUTC).toLocaleDateString('ar-EG')} إلى ${new Date(endUTC).toLocaleDateString('ar-EG')}`, {
         align: 'right'
       })
       .moveDown(1);

    // Add notes
    snapshot.forEach((noteDoc) => {
      const data = noteDoc.data();
      const date = new Date(data.timestamp.seconds * 1000).toLocaleDateString('ar-EG');
      
      pdfDoc.fontSize(12)
         .text(`التاريخ: ${date}`, { align: 'right' })
         .moveDown(0.3);

      pdfDoc.fontSize(10)
         .text(`الملاحظات:\n${data.notes.join('\n')}`, {
           align: 'right',
           indent: 10
         })
         .moveDown(0.3);

      pdfDoc.text(`النقاط: ${data.points}`, { align: 'right' })
         .moveDown(1)
         .lineWidth(0.5)
         .strokeColor('#cccccc')
         .lineCap('butt')
         .moveTo(50, pdfDoc.y)
         .lineTo(550, pdfDoc.y)
         .stroke()
         .moveDown(1);
    });

    // Finalize PDF
    pdfDoc.end();

  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: "خطأ في توليد الملف" });
    }
  }
});













module.exports = router;
