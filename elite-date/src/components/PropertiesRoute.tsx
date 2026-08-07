import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PropertiesRoute() {
  const [properties, setProperties] = useState<any[]>([])

  useEffect(() => {
    async function fetchProperties() {
      const { data, error } = await supabase.from('properties').select('*')
      if (error) {
        console.error('Error fetching properties:', error)
      } else {
        setProperties(data || [])
      }
    }
    fetchProperties()
  }, [])

  return (
    <div style={{ marginTop: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Available Properties</h2>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {properties.map((property) => (
          <li key={property.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <strong>{property.title}</strong> - ${property.price} <br/>
            <small>{property.address}, {property.city} | Status: {property.status}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}