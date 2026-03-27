// Encrypt function
export async function encryptFile(file: Blob) {
  const fileBuffer = await file.arrayBuffer();

  // 1️⃣ Generate AES-256 key
  const key = await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // 2️⃣ Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3️⃣ Encrypt file
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileBuffer
  );

  // 4️⃣ Export key (raw format)
  const exportedKey = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedBlob: new Blob([encryptedBuffer]),
    key: exportedKey,
    iv: iv
  };
}

// Convert key and IV to base64
export function bufferToBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Decrypt function 
export async function decryptFile(encryptedBlob: Blob, base64Key: string, base64IV: string, mimeType: string) {
  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  const keyBuffer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(base64IV), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedBuffer
  );

  // 🚀 FIX: Explicitly assign the MIME type to the decrypted blob!
  return new Blob([decryptedBuffer], { type: mimeType });
}

// Fetches encrypted file from Firebase and decrypts it into a local readable URL
export async function getAccessibleDocumentUrl(fileUrl: string, base64Key: string, base64IV: string, mimeType: string): Promise<string> {
  try {
    if(!fileUrl || !base64Key || !base64IV){
      return '';
    }
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch encrypted file: ${response.statusText}`);
    const encryptedBlob = await response.blob();

    // 🚀 FIX: Pass the mimeType down to the decrypt function
    const decryptedBlob = await decryptFile(encryptedBlob, base64Key, base64IV, mimeType);

    return URL.createObjectURL(decryptedBlob);
  } catch (error) {
    console.error("Error in getAccessibleDocumentUrl:", error);
    throw error;
  }
}