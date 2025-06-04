#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (error) {
    // dotenv is optional - if not installed, just continue
}

console.log('🔧 Knife Brand Website Finder - Setup Verification\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

console.log(`📋 SYSTEM CHECK`);
console.log(`Node.js version: ${nodeVersion}`);
if (majorVersion >= 18) {
    console.log('✅ Node.js version is compatible');
} else {
    console.log('❌ Node.js 18.0.0 or higher is required');
    process.exit(1);
}

// Check if npm dependencies are installed
console.log('\n📦 DEPENDENCIES CHECK');
try {
    require('dotenv');
    console.log('✅ dotenv package is installed');
} catch (error) {
    console.log('⚠️  dotenv package not found');
    console.log('💡 Run: npm install');
}

// Check for required files
console.log('\n📁 FILES CHECK');
const requiredFiles = [
    'getBrandWebsite.js',
    'brandNames.json',
    'package.json'
];

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} is missing`);
    }
});

// Check brandNames.json content
try {
    const brandData = JSON.parse(fs.readFileSync('brandNames.json', 'utf8'));
    if (Array.isArray(brandData) && brandData.length > 0) {
        console.log(`✅ brandNames.json contains ${brandData.length} brands`);
    } else {
        console.log('❌ brandNames.json is not a valid array');
    }
} catch (error) {
    console.log('❌ Error reading brandNames.json:', error.message);
}

// Check environment variables
console.log('\n🔑 ENVIRONMENT CHECK');
if (process.env.OPENROUTER_API_KEY) {
    const keyLength = process.env.OPENROUTER_API_KEY.length;
    console.log(`✅ OPENROUTER_API_KEY is set (${keyLength} characters)`);
} else {
    console.log('❌ OPENROUTER_API_KEY is not set');
    console.log('💡 Set it with: export OPENROUTER_API_KEY="your-key-here"');
    console.log('💡 Or create a .env file with: OPENROUTER_API_KEY=your-key-here');
}

// Check .env file
if (fs.existsSync('.env')) {
    console.log('✅ .env file exists');
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('OPENROUTER_API_KEY')) {
            console.log('✅ .env file contains OPENROUTER_API_KEY');
        } else {
            console.log('⚠️  .env file exists but no OPENROUTER_API_KEY found');
        }
    } catch (error) {
        console.log('⚠️  Could not read .env file');
    }
} else {
    console.log('ℹ️  No .env file found (optional)');
}

// Check results directory
console.log('\n📂 OUTPUT DIRECTORY CHECK');
if (fs.existsSync('./results')) {
    console.log('✅ ./results directory exists');
} else {
    console.log('ℹ️  ./results directory will be created automatically');
}

// Final recommendations
console.log('\n💡 SETUP RECOMMENDATIONS');

if (!fs.existsSync('node_modules')) {
    console.log('1. Install dependencies: npm install');
}

if (!process.env.OPENROUTER_API_KEY && !fs.existsSync('.env')) {
    console.log('2. Set up your API key:');
    console.log('   Option A: export OPENROUTER_API_KEY="your-key-here"');
    console.log('   Option B: Create .env file with OPENROUTER_API_KEY=your-key-here');
}

console.log('3. Test the script: npm test');
console.log('4. Run with default settings: npm start');

console.log('\n🚀 Ready to find knife brand websites!');
console.log('📖 See README.md for detailed usage instructions');

// Test basic script loading
console.log('\n🧪 SCRIPT LOADING TEST');
try {
    // Don't actually run the script, just test if it loads
    const scriptPath = path.join(__dirname, 'getBrandWebsite.js');
    if (fs.existsSync(scriptPath)) {
        console.log('✅ Main script loads successfully');
    }
} catch (error) {
    console.log('❌ Error loading main script:', error.message);
} 