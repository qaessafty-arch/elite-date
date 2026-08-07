import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function ContractsRoute() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContracts() {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_type,
          agreed_amount,
          status,
          start_date,
          properties (title, city),
          clients (name, email)
        `);

      if (error) {
        console.error('Error fetching contracts:', error);
      } else {
        setContracts(data || []);
      }
      setLoading(false);
    }

    fetchContracts();
  }, []);

  if (loading) return <div>Loading contracts...</div>;

  return (
    <div>
      <h2>Real Estate Contracts</h2>
      <ul>
        {contracts.map((contract) => (
          <li key={contract.id}>
            {contract.contract_type.toUpperCase()} - {contract.properties?.title} ({contract.clients?.name}) - ${contract.agreed_amount}
          </li>
        ))}
      </ul>
    </div>
  );
}