import React, { useState, useEffect } from 'react';
import { CreditCard, Shield, Key, Activity, Plus, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

// Utility functions for crypto operations (simplified for demo)
const CryptoUtils = {
    generateNonce: () => Math.random().toString(36).substring(2, 15),

    // Simplified base64 encode/decode for demo
    toBase64: (str) => btoa(str),
    fromBase64: (str) => atob(str),

    // Mock encryption functions for demo purposes
    mockEncrypt: (data, key) => CryptoUtils.toBase64(JSON.stringify(data)),
    mockDecrypt: (encryptedData, key) => JSON.parse(CryptoUtils.fromBase64(encryptedData)),

    generateMockSignature: (data) => CryptoUtils.toBase64('mock_signature_' + JSON.stringify(data))
};

// API service functions
const apiService = {
    async healthCheck() {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.json();
    },

    async createMerchant(merchantData) {
        const response = await fetch(`${API_BASE_URL}/merchants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merchantData)
        });
        return response.json();
    },

    async exchangeKeys(keyRequest) {
        const response = await fetch(`${API_BASE_URL}/keys/exchange/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keyRequest)
        });
        return response.json();
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
        return response.json();
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
            // Create key request payload
            const payload = {
                merchantId: parseInt(selectedMerchant),
                nonce: CryptoUtils.generateNonce(),
                timestamp: Date.now()
            };

            // Mock encryption and signing for demo
            const encryptedPayload = CryptoUtils.mockEncrypt(payload, 'server_public_key');
            const signature = CryptoUtils.generateMockSignature(payload);

            const keyRequest = {
                ciphertext: encryptedPayload,
                signature: signature
            };

            const result = await apiService.exchangeKeys(keyRequest);
            setMessage('Key exchange completed successfully!');
        } catch (error) {
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
            // Mock PAN encryption for demo
            const encryptedPan = {
                panCiphertext: CryptoUtils.mockEncrypt(formData.pan, 'aes_key'),
                iv: CryptoUtils.toBase64('mock_iv_12345678')
            };

            const transactionData = {
                merchantId: parseInt(formData.merchantId),
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                pan: encryptedPan
            };

            const timestamp = Date.now();
            const signature = CryptoUtils.generateMockSignature({...transactionData, timestamp});

            const result = await apiService.createTransaction(transactionData, signature, timestamp);
            setMessage(`Transaction created successfully! ID: ${result.transactionId}`);
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