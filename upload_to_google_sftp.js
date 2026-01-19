// Script to upload product feed to Google Merchant Center via SFTP
const Client = require('ssh2-sftp-client');
const path = require('path');

const sftp = new Client();

// SFTP connection details
const config = {
    host: 'partnerupload.google.com',
    port: 19321,
    username: 'mc-sftp-5557137468',
    password: 'W6g^>4@o<;',
    readyTimeout: 20000
};

// File to upload - using TSV format as Google prefers it
const localFile = 'Google Merchant Centre feed – Products source - Sheet1.tsv';
const remoteFile = 'Google Merchant Centre feed – Products source - Sheet1.tsv';

async function uploadFile() {
    try {
        console.log('🔌 Connecting to Google SFTP server...');
        await sftp.connect(config);
        console.log('✅ Connected successfully!');
        
        console.log(`📤 Uploading file: ${localFile}...`);
        await sftp.put(localFile, remoteFile);
        console.log('✅ File uploaded successfully!');
        
        // Verify the file was uploaded
        const list = await sftp.list('/');
        const uploadedFile = list.find(file => file.name === remoteFile);
        
        if (uploadedFile) {
            console.log(`\n📊 Upload verification:`);
            console.log(`   File name: ${uploadedFile.name}`);
            console.log(`   File size: ${uploadedFile.size} bytes`);
            console.log(`   Modified: ${uploadedFile.modifyTime}`);
        }
        
        await sftp.end();
        console.log('\n✅ Upload complete! Your product feed is now on Google\'s servers.');
        console.log('   You can now configure it in Google Merchant Center.');
        
    } catch (error) {
        console.error('❌ Error uploading file:', error.message);
        process.exit(1);
    }
}

uploadFile();


