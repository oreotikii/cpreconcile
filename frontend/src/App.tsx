import { ThemeProvider } from "@/components/theme-provider"
import { Dashboard } from "@/components/dashboard"
import "./index.css"

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="cpreconcile-ui-theme">
      <Dashboard />
    </ThemeProvider>
  )
}

export default App
