import React, { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8080/api/health')
        .then(response => response.json())
        .then(data => {
          console.log("Health API response:", data); // debug
          setStatus(data);
        })
        .catch(error => {
          console.error('Fetch error:', error); // debug
          setStatus({ status: 'Error', db: 'Unavailable' });
        });
  }, []);

  return (
      <div style={{ padding: '2rem' }}>
        <h1>SecurePay Health Check</h1>
        {status ? (
            <div>
              <p><strong>Backend Status:</strong> {status.status}</p>
              <p><strong>DB Status:</strong> {status.db}</p>
            </div>
        ) : (
            <p>Loading...</p>
        )}
      </div>
  );
}

export default App;
