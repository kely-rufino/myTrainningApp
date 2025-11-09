import { Counter } from './components/Counter'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-600 dark:text-white mb-2">
            Training App
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Counter API Test com React + Vite + Tailwind + Radix UI
          </p>
        </div>

        {/* Counter Component */}
        <Counter />
      </div>
    </div>
  )
}

export default App
