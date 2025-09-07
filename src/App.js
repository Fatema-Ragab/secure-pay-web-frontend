import React, { useState, useEffect } from 'react';
import { CreditCard, Shield, Key, Activity, Plus, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import CryptoJS from 'crypto-js';

const API_BASE_URL = '/api';

// Crypto utilities using only Web Crypto API and CryptoJS
const CryptoUtils = {
    generateNonce: () => Math.random().toString(36).substring(2, 15),

    // Base64 encode/decode
    toBase64: (str) => btoa(str),
    fromBase64: (str) => atob(str),

    // Convert string to bytes and vice versa
    stringToBytes: (str) => new TextEncoder().encode(str),
    bytesToString: (bytes) => new TextDecoder().decode(bytes),

    // Generate random IV
    generateRandomIV: (length) => {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array);
    },

    // Load keys from files
    serverPublicKeyPem: null,
    clientPrivateKeyPem: null,

    async loadKeys() {
        try {
            if (!this.serverPublicKeyPem) {
                console.log('Loading server public key...');
                const serverPubResponse = await fetch('/keys/rsa_public.pem');
                if (!serverPubResponse.ok) {
                    throw new Error(`Failed to load server public key: ${serverPubResponse.status}`);
                }
                this.serverPublicKeyPem = await serverPubResponse.text();
                console.log('Server public key loaded:', this.serverPublicKeyPem.substring(0, 50) + '...');
            }
            if (!this.clientPrivateKeyPem) {
                console.log('Loading client private key...');
                const clientPrivResponse = await fetch('/keys/client_rsa_private.pem');
                if (!clientPrivResponse.ok) {
                    throw new Error(`Failed to load client private key: ${clientPrivResponse.status}`);
                }
                this.clientPrivateKeyPem = await clientPrivResponse.text();
                console.log('Client private key loaded:', this.clientPrivateKeyPem.substring(0, 50) + '...');
            }
        } catch (error) {
            console.error('Error loading keys:', error);
            throw error;
        }
    },

    // RSA Encryption using Web Crypto API
    async rsaEncrypt(plaintext) {
        await this.loadKeys();
        try {
            console.log('Attempting RSA encryption with Web Crypto API...');

            // Convert PEM to ArrayBuffer
            const pemContents = this.serverPublicKeyPem
                .replace(/-----BEGIN PUBLIC KEY-----/g, '')
                .replace(/-----END PUBLIC KEY-----/g, '')
                .replace(/\s/g, '');

            const keyBuffer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

            // Import the key
            const publicKey = await crypto.subtle.importKey(
                'spki',
                keyBuffer,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                false,
                ['encrypt']
            );

            // Encrypt the plaintext
            const plaintextBuffer = new TextEncoder().encode(plaintext);
            const encrypted = await crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                publicKey,
                plaintextBuffer
            );

            const result = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
            console.log('RSA encryption successful');
            return result;
        } catch (error) {
            console.error('RSA encryption failed:', error);
            throw new Error('RSA encryption failed: ' + error.message);
        }
    },

    // RSA Signing using Web Crypto API
    async rsaSign(message) {
        await this.loadKeys();
        try {
            console.log('Attempting RSA signing with Web Crypto API...');

            // Convert PEM to ArrayBuffer
            const pemContents = this.clientPrivateKeyPem
                .replace(/-----BEGIN PRIVATE KEY-----/g, '')
                .replace(/-----END PRIVATE KEY-----/g, '')
                .replace(/\s/g, '');

            const keyBuffer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

            // Import the private key
            const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                keyBuffer,
                {
                    name: 'RSA-PSS',
                    hash: 'SHA-256'
                },
                false,
                ['sign']
            );

            // Sign the message
            const messageBuffer = new TextEncoder().encode(message);
            const signature = await crypto.subtle.sign(
                {
                    name: 'RSA-PSS',
                    saltLength: 32
                },
                privateKey,
                messageBuffer
            );

            const result = btoa(String.fromCharCode(...new Uint8Array(signature)));
            console.log('RSA signing successful');
            return result;
        } catch (error) {
            console.error('RSA signing failed:', error);
            throw new Error('RSA signing failed: ' + error.message);
        }
    },

    // HMAC-SHA256
    hmacSha256: (key, message) => {
        const keyWords = CryptoJS.enc.Base64.parse(key);
        const messageWords = CryptoJS.enc.Utf8.parse(message);
        const hmac = CryptoJS.HmacSHA256(messageWords, keyWords);
        return CryptoJS.enc.Base64.stringify(hmac);
    },

    // AES-GCM encryption
    async aesEncrypt(key, iv, plaintext) {
        try {
            const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
            const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
            const plaintextBuffer = new TextEncoder().encode(plaintext);

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: ivBuffer },
                cryptoKey,
                plaintextBuffer
            );

            return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        } catch (error) {
            console.error('AES encryption failed:', error);
            // Fallback to crypto-js
            const keyWords = CryptoJS.enc.Base64.parse(key);
            const ivWords = CryptoJS.enc.Base64.parse(iv);
            const encrypted = CryptoJS.AES.encrypt(plaintext, keyWords, {
                iv: ivWords,
                mode: CryptoJS.mode.CTR,
                padding: CryptoJS.pad.NoPadding
            });
            return encrypted.toString();
        }
    }
};

// API service functions
const apiService = {
    async healthCheck() {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    },

    async createMerchant(merchantData) {
        const response = await fetch(`${API_BASE_URL}/merchants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merchantData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Merchant creation response:', result);
        return result;
    },

    async exchangeKeys(keyRequest) {
        const response = await fetch(`${API_BASE_URL}/keys/exchange/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keyRequest)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Key exchange response:', result);
        return result;
    },

    async createTransaction(transactionData, signature, timestamp) {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Transaction response:', result);
        return result;
    }
};

// Health Check Component
const HealthCheck = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkHealth = async () => {
        setLoading(true);
        try {
            const result = await apiService.healthCheck();
            setHealth(result);
        } catch (error) {
            setHealth({ status: 'ERROR', error: error.message });
        }
        setLoading(false);
    };

    useEffect(() => {
        checkHealth();
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    System Health
                </h2>
                <button
                    onClick={checkHealth}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                </button>
            </div>

            {health && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {health.status === 'OK' ?
                            <CheckCircle className="w-5 h-5 text-green-500" /> :
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        }
                        <span className="font-medium">Status: {health.status}</span>
                    </div>
                    {health.db && (
                        <div className="flex items-center gap-2">
                            {health.db === 'Connected' ?
                                <CheckCircle className="w-5 h-5 text-green-500" /> :
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            }
                            <span>Database: {health.db}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Merchant Management Component
const MerchantManagement = ({ onMerchantCreated }) => {
    const [formData, setFormData] = useState({ name: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async () => {
        setLoading(true);
        setMessage('');

        if (!formData.name || !formData.email) {
            setMessage('Please fill in all fields');
            setLoading(false);
            return;
        }

        try {
            const result = await apiService.createMerchant(formData);
            setMessage(`Merchant created successfully! ID: ${result.id}`);
            setFormData({ name: '', email: '' });
            onMerchantCreated(result);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }

        setLoading(false);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Merchant
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Merchant Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {loading ? 'Creating...' : 'Create Merchant'}
                </button>
            </div>

            {message && (
                <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

// Key Exchange Component
const KeyExchange = ({ merchants }) => {
    const [selectedMerchant, setSelectedMerchant] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleKeyExchange = async () => {
        if (!selectedMerchant) {
            setMessage('Please select a merchant');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            console.log('Starting key exchange...');

            // Create key request payload
            const payload = {
                merchantId: parseInt(selectedMerchant),
                nonce: CryptoUtils.generateNonce(),
                timestamp: Date.now()
            };

            console.log('Payload created:', payload);

            // Real RSA encryption and signing
            const payloadJson = JSON.stringify(payload);
            console.log('Payload JSON:', payloadJson);

            console.log('About to encrypt...');
            const encryptedPayload = await CryptoUtils.rsaEncrypt(payloadJson);
            console.log('Encryption completed');

            console.log('About to sign...');
            const signature = await CryptoUtils.rsaSign(payloadJson);
            console.log('Signing completed');

            const keyRequest = {
                ciphertext: encryptedPayload,
                signature: signature
            };

            console.log('Sending key request:', keyRequest);
            const result = await apiService.exchangeKeys(keyRequest);
            setMessage('Key exchange completed successfully!');
        } catch (error) {
            console.error('Key exchange error:', error);
            setMessage(`Error: ${error.message}`);
        }

        setLoading(false);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Key Exchange
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Select Merchant</label>
                    <select
                        value={selectedMerchant}
                        onChange={(e) => setSelectedMerchant(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    >
                        <option value="">Choose a merchant...</option>
                        {merchants.map(merchant => (
                            <option key={merchant.id} value={merchant.id}>
                                {merchant.name} ({merchant.email})
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleKeyExchange}
                    disabled={loading || !selectedMerchant}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loading ? 'Exchanging Keys...' : 'Exchange Keys'}
                </button>
            </div>

            {message && (
                <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

// Transaction Component
const TransactionForm = ({ merchants }) => {
    const [formData, setFormData] = useState({
        merchantId: '',
        amount: '',
        currency: 'USD',
        pan: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async () => {
        if (!formData.merchantId || !formData.amount || !formData.pan) {
            setMessage('Please fill in all required fields');
            return;
        }

        if (formData.pan.length !== 16) {
            setMessage('Please enter a valid 16-digit card number');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Generate AES key and IV for PAN encryption
            const aesKey = btoa(String.fromCharCode(...CryptoUtils.generateRandomIV(32))); // 256-bit key
            const iv = btoa(String.fromCharCode(...CryptoUtils.generateRandomIV(16))); // 128-bit IV

            // Encrypt PAN
            const encryptedPan = {
                panCiphertext: await CryptoUtils.aesEncrypt(aesKey, iv, formData.pan),
                iv: iv
            };

            const transactionData = {
                merchantId: parseInt(formData.merchantId),
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                pan: encryptedPan
            };

            const timestamp = Date.now();
            const signatureBase = JSON.stringify(transactionData) + timestamp;

            // Generate HMAC signature (using mock HMAC key for demo)
            const mockHmacKey = btoa('mock_hmac_key_for_demo_purposes_32bytes');
            const signature = CryptoUtils.hmacSha256(mockHmacKey, signatureBase);

            const result = await apiService.createTransaction(transactionData, signature, timestamp);
            console.log('Transaction result:', result);
            setMessage(`Transaction created successfully! ID: ${result.transactionId || result.id || 'Unknown'}`);
            setFormData({ merchantId: '', amount: '', currency: 'USD', pan: '' });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }

        setLoading(false);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Create Transaction
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Merchant</label>
                    <select
                        value={formData.merchantId}
                        onChange={(e) => setFormData({...formData, merchantId: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    >
                        <option value="">Choose a merchant...</option>
                        {merchants.map(merchant => (
                            <option key={merchant.id} value={merchant.id}>
                                {merchant.name} ({merchant.email})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Currency</label>
                        <select
                            value={formData.currency}
                            onChange={(e) => setFormData({...formData, currency: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Card Number (PAN)</label>
                    <input
                        type="text"
                        value={formData.pan}
                        onChange={(e) => setFormData({...formData, pan: e.target.value.replace(/\D/g, '')})}
                        placeholder="1234567890123456"
                        maxLength="16"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                    <p className="text-sm text-gray-500 mt-1">Enter 16-digit card number (will be encrypted)</p>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || !formData.merchantId}
                    className="w-full px-4 py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {loading ? 'Processing...' : 'Create Transaction'}
                </button>
            </div>

            {message && (
                <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

// Main App Component
const SecurePayApp = () => {
    const [merchants, setMerchants] = useState([]);

    const handleMerchantCreated = (merchant) => {
        setMerchants(prev => [...prev, merchant]);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Shield className="w-8 h-8 text-blue-600" />
                        <h1 className="text-4xl font-bold text-gray-800">SecurePay</h1>
                    </div>
                    <p className="text-lg text-gray-600">Secure Payment Processing Platform</p>
                </div>

                {/* Content Grid */}
                <div className="max-w-4xl mx-auto space-y-6">
                    <HealthCheck />

                    <div className="grid md:grid-cols-2 gap-6">
                        <MerchantManagement onMerchantCreated={handleMerchantCreated} />
                        <KeyExchange merchants={merchants} />
                    </div>

                    <TransactionForm merchants={merchants} />
                </div>

                {/* Footer */}
                <div className="text-center mt-12 text-gray-500">
                    <p>SecurePay Platform - Encrypted Transaction Processing</p>
                </div>
            </div>
        </div>
    );
};

export default SecurePayApp;