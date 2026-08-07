import ContractsRoute from './components/ContractsRoute'
import PropertiesRoute from './components/PropertiesRoute'

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Elite Data Real Estate Platform</h1>
      <PropertiesRoute />
      <ContractsRoute />
    </div>
  )
}

export default App