import { useEffect, useState } from 'react';
import { obtenerColeccion } from '@/supabase/database';

function TestFirebase() {
  const [estado, setEstado] = useState('🔄 Conectando a Firebase...');
  const [datos, setDatos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const probarConexion = async () => {
      try {
        // IMPORTANTE: Cambia 'users' por el nombre de una colección que tengas en Firestore
        const docs = await obtenerColeccion('user');
        setDatos(docs);
        setEstado('✅ Conectado exitosamente a Firebase ALIANZA');
        console.log("✅ Datos obtenidos:", docs);
      } catch (err) {
        setError(err.message);
        setEstado('❌ Error de conexión');
        console.error("❌ Error:", err);
      }
    };

    probarConexion();
  }, []);

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial', maxWidth: '800px' }}>
      <h1>🔥 Test de Conexión Firebase</h1>
      <div style={{ 
        padding: '20px', 
        background: error ? '#ffebee' : '#e8f5e9',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <p style={{ fontSize: '18px', margin: 0 }}><strong>{estado}</strong></p>
        {!error && <p>Documentos encontrados: <strong>{datos.length}</strong></p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>

      {datos.length > 0 && (
        <details style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '16px' }}>
            📄 Ver datos (click para expandir)
          </summary>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(datos, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default TestFirebase;