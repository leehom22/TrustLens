# TrustLens - Setup Instructions

## Overview
This application is a professional document forensic engine that uses Firebase for authentication and provides features like email notifications, PDF report generation, and speech-to-text using Deepgram.

## Features Implemented

1. ✅ **Firebase Authentication** - Google Sign-In required before using the app
2. ✅ **Email Notifications** - Sends email to authenticated user when analysis completes
3. ✅ **PDF Report Generation** - Complete analysis report downloadable as PDF
4. ✅ **File Size Validation** - Maximum 10MB upload limit with validation
5. ✅ **Warning Banner** - Alerts users not to close the page during analysis
6. ✅ **Speech-to-Text** - Deepgram integration for chatbox voice input
7. ✅ **Dark/Light Mode** - Theme toggle available throughout the app
8. ✅ **Fixed AI Chatbox** - Remains in position while scrolling through analysis results
9. ✅ **Mobile Responsive** - Fully optimized for mobile devices

## Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "Document-Forensic-Engine")
4. (Optional) Enable Google Analytics if you want usage tracking
5. Click "Create project"

### Step 2: Enable Google Authentication

1. In your Firebase project, go to **Build** > **Authentication**
2. Click "Get started"
3. Go to the **Sign-in method** tab
4. Click on **Google** in the providers list
5. Toggle the **Enable** switch
6. Enter your project support email
7. Click **Save**

### Step 3: Register Your Web App

1. In Firebase Console, click the **⚙️ icon** (Project settings)
2. Scroll down to "Your apps" section
3. Click the **Web icon** (`</>`)
4. Register your app with a nickname (e.g., "Web App")
5. **Copy the Firebase configuration object** - you'll need this!

### Step 4: Configure Firebase in Your App

1. Open `/src/lib/firebase.ts` in your project
2. Replace the placeholder values with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",              // Replace with actual API key
  authDomain: "YOUR_AUTH_DOMAIN_HERE",       // Replace with actual auth domain
  projectId: "YOUR_PROJECT_ID_HERE",         // Replace with actual project ID
  storageBucket: "YOUR_STORAGE_BUCKET_HERE", // Replace with actual storage bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE", // Replace with actual sender ID
  appId: "YOUR_APP_ID_HERE"                  // Replace with actual app ID
};
```

Example of what it should look like:
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuv",
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project-12345",
  storageBucket: "my-project-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

## Email Notifications Setup (Optional)

The app currently simulates email sending by logging to the console. **To send actual emails with the PDF report attached, you must implement a backend email service yourself.**

### What the App Currently Does:
- ✅ Generates a complete PDF analysis report (available via download button)
- ✅ Logs email notification information to browser console
- ✅ Shows toast notification when "email sent" (simulated)
- ❌ Does NOT actually send emails (requires your implementation)

### How to Implement Real Email Sending with PDF Attachment:

You have **two main approaches**:

---

### Option 1: Firebase Functions + SendGrid/Mailgun (Recommended)

This approach keeps your API keys secure on the backend.

**Step 1:** Initialize Firebase Functions
```bash
firebase init functions
```

**Step 2:** Install email service SDK
```bash
cd functions
npm install @sendgrid/mail
# OR
npm install mailgun-js
```

**Step 3:** Create a Cloud Function (`functions/src/index.ts`)
```typescript
import * as functions from 'firebase-functions';
import * as sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendAnalysisEmail = functions.https.onCall(async (data) => {
  const { email, fileName, pdfBase64 } = data;
  
  const msg = {
    to: email,
    from: 'noreply@yourapp.com',
    subject: `Document Analysis Complete - ${fileName}`,
    html: `
      <h2>Analysis Complete!</h2>
      <p>Your forensic analysis for <strong>${fileName}</strong> has been completed.</p>
      <p>Please find the detailed analysis report attached.</p>
    `,
    attachments: [
      {
        content: pdfBase64,
        filename: `${fileName}_Forensic_Report.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };
  
  await sgMail.send(msg);
  return { success: true };
});
```

**Step 4:** Update `/src/app/components/AnalysisInterface.tsx`

Replace the `sendEmailNotification` function (around line 86) with:

```typescript
const sendEmailNotification = async (email: string) => {
  try {
    // Import Firebase Functions
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions();
    
    // Generate PDF as base64
    const analysisData: AnalysisData = {
      // ... (use the same mock data from handleDownloadPDF)
    };
    const pdf = generateAnalysisPDF(analysisData);
    const pdfBase64 = pdf.output('datauristring').split(',')[1]; // Extract base64
    
    // Call Cloud Function
    const sendEmail = httpsCallable(functions, 'sendAnalysisEmail');
    await sendEmail({ 
      email, 
      fileName,
      pdfBase64 
    });
    
    console.log(`✅ Email sent successfully to: ${email}`);
  } catch (error) {
    console.error('Email sending failed:', error);
    // Still show success to user as analysis completed
  }
};
```

**Step 5:** Deploy Firebase Functions
```bash
firebase deploy --only functions
```

**Step 6:** Set SendGrid API Key
```bash
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
```

---

### Option 2: Direct Email API (Client-Side)

⚠️ **Warning:** This exposes your API key in the frontend. Only use for testing or if you have proper security measures.

**Services you can use:**
- [SendGrid](https://sendgrid.com/) - 100 emails/day free
- [Mailgun](https://www.mailgun.com/) - 100 emails/day free
- [Resend](https://resend.com/) - 100 emails/day free
- [AWS SES](https://aws.amazon.com/ses/)

**Example with Resend:**

```bash
npm install resend
```

Update `sendEmailNotification` in `/src/app/components/AnalysisInterface.tsx`:

```typescript
const sendEmailNotification = async (email: string) => {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend('YOUR_RESEND_API_KEY');
    
    // Generate PDF
    const analysisData: AnalysisData = { /* ... */ };
    const pdf = generateAnalysisPDF(analysisData);
    const pdfBuffer = pdf.output('arraybuffer');
    
    await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to: email,
      subject: `Document Analysis Complete - ${fileName}`,
      html: '<p>Your analysis is complete. See attached report.</p>',
      attachments: [
        {
          filename: `${fileName}_Forensic_Report.pdf`,
          content: Buffer.from(pdfBuffer)
        }
      ]
    });
    
    console.log('✅ Email sent with PDF attachment');
  } catch (error) {
    console.error('Email error:', error);
  }
};
```

---

### Understanding the PDF Report:

**What's in the PDF:**
- Complete metadata analysis (IP address, editing software, dates)
- All security findings with severity levels
- Section-by-section content analysis
- Critical recommendations
- Risk level assessment

**The PDF is generated using jsPDF and includes:**
- Professional formatting with headers and sections
- Color-coded severity indicators
- Multi-page layout
- File metadata and forensic findings
- All the same information displayed in the web interface

**Current behavior:**
1. Analysis completes → PDF is generated in memory
2. User can click download button → PDF downloads to their device
3. Email notification is simulated (logged to console)

**After you implement email:**
1. Analysis completes → PDF is generated
2. PDF is converted to base64 or buffer
3. Email service sends email with PDF as attachment
4. User receives email with downloadable PDF report
5. Download button still available in the app

---

### Production Recommendations:

✅ **DO:**
- Use Firebase Functions or a backend API to send emails
- Store API keys in environment variables or Firebase config
- Implement rate limiting to prevent abuse
- Add user consent for email notifications
- Test email delivery thoroughly

❌ **DON'T:**
- Expose API keys in frontend code
- Send emails without user permission
- Include sensitive data in email body (use attachment)
- Commit API keys to version control

## Deepgram Speech-to-Text Setup (Optional)

Currently, the speech-to-text feature is simulated. To enable actual transcription:

### Step 1: Get Deepgram API Key

1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign up or log in
3. Create a new API key from the dashboard
4. Copy your API key

### Step 2: Install Deepgram SDK

The SDK is already installed (`@deepgram/sdk`).

### Step 3: Update AnalysisInterface Component

In `/src/app/components/AnalysisInterface.tsx`, update the `stopRecording` function:

```typescript
const stopRecording = async () => {
  if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // Actual Deepgram implementation
    const { createClient } = await import('@deepgram/sdk');
    const deepgram = createClient('YOUR_DEEPGRAM_API_KEY');
    
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBlob,
      { model: 'nova', smart_format: true }
    );
    
    const transcript = result.results.channels[0].alternatives[0].transcript;
    setMessage(transcript);
    toast.success("Transcription complete!");
  }
};
```

## PDF Report Generation

The application automatically generates comprehensive PDF reports of the analysis results.

### Features:
- **Complete Analysis Data**: Includes all metadata, findings, content analysis, and recommendations
- **Professional Formatting**: Multi-page PDF with proper sections and formatting
- **Download Button**: Floating download button appears after analysis completes
- **Email Attachment**: PDF can be attached to email notifications (requires custom implementation)

### How It Works:
1. Analysis completes and displays results
2. Click the floating **Download** button (bottom-right corner)
3. PDF report downloads automatically with filename: `{original_filename}_Forensic_Report.pdf`

### Customizing PDF Report:
The PDF generation logic is in `/src/lib/pdfGenerator.ts`. You can customize:
- Report styling and colors
- Additional sections
- Company branding
- Header/footer information

## File Upload Validation

### Upload Limits:
- **Maximum file size**: 10MB
- **Supported formats**: PDF, DOC, DOCX, PNG, JPG

### User Experience:
- File size is validated before upload
- Clear error messages if file exceeds limit
- File type validation with helpful error messages
- Success toast notification on valid upload

### How It Works:
- File size checked in bytes (10MB = 10 * 1024 * 1024 bytes)
- MIME type validation for file formats
- User-friendly error messages with file size displayed in MB

## Running the Application

1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local development URL

## Features Walkthrough

### 1. Authentication
- Users must sign in with Google before accessing the app
- User information is displayed in the top bar
- Theme toggle (light/dark mode) is available
- Sign out button to logout

### 2. Document Upload
- Drag and drop or click to upload documents
- Supported formats: PDF, DOC, DOCX, PNG, JPG
- Theme adapts based on user preference

### 3. Analysis Process
- **Warning Banner**: Displays during analysis warning users not to close the page
- **Email Notification**: Simulates sending email when analysis completes
- **AI Chatbox**: Fixed on the left side, stays in place while scrolling
- **Speech Input**: Click microphone icon to record voice messages
- **Progressive Analysis**: Shows detailed AI processing steps

### 4. Results
- Comprehensive metadata analysis
- Interactive heatmap visualization
- Section-by-section content analysis
- Key findings with severity levels
- AI assistant for questions

## Theme System

The app supports both dark and light modes:
- Default theme: Dark
- Toggle available in authentication screen and main app
- Persists across sessions using `next-themes`
- All components are theme-aware

## Security Considerations

⚠️ **Important Security Notes:**

1. **Never commit Firebase config with real credentials to public repositories**
2. **Use environment variables** for production deployments
3. **Enable Firebase Security Rules** to protect your data
4. **Set up Firebase App Check** to prevent abuse
5. **Rotate API keys regularly**

## Troubleshooting

### Firebase Authentication Not Working
- Verify Firebase config is correct
- Check browser console for errors
- Ensure Google Sign-In is enabled in Firebase Console
- Check authorized domains in Firebase Auth settings

### Theme Not Switching
- Clear browser cache and cookies
- Check if `next-themes` is properly installed
- Verify ThemeProvider wraps the entire app

### Speech-to-Text Not Working
- Check microphone permissions in browser
- Verify Deepgram API key is valid
- Ensure browser supports MediaRecorder API

## Production Deployment Checklist

- [ ] Replace all placeholder Firebase config values
- [ ] Set up environment variables for sensitive data
- [ ] Configure Firebase Security Rules
- [ ] Set up Firebase App Check
- [ ] Implement real email sending service
- [ ] Configure Deepgram API for speech-to-text
- [ ] Test authentication flow
- [ ] Test theme persistence
- [ ] Verify all features work in production build

## Support

For issues or questions:
1. Check Firebase documentation: https://firebase.google.com/docs
2. Check Deepgram documentation: https://developers.deepgram.com
3. Review console errors for debugging information