import { useQuery } from '@tanstack/react-query'

type PingResponse = {
  message: string
  timestamp: string
}

async function fetchPing(): Promise<PingResponse> {
  const res = await fetch('/api/ping')
  if (!res.ok) throw new Error('Network error')
  return res.json()
}

function App() {
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['ping'],
    queryFn: fetchPing,
    enabled: false,
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">Frontend ↔ Backend test</h1>

      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        {isFetching ? 'Calling...' : 'Ping backend'}
      </button>

      {error && (
        <p className="text-red-400">Error: {(error as Error).message}</p>
      )}

      {data && (
        <div className="bg-gray-800 rounded-lg p-4 text-sm font-mono space-y-1">
          <p>message: <span className="text-green-400">{data.message}</span></p>
          <p>timestamp: <span className="text-blue-400">{data.timestamp}</span></p>
        </div>
      )}
    </div>
  )
}

export default App
