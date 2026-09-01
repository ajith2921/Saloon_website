// App.jsx — entry rendered by main.jsx
// Routing is handled by AppRouter (see src/routes/AppRouter.jsx)
import AppRouter from './routes/AppRouter'
import { InstallAppBanner } from './components/ui'
import './App.css'

export default function App() {
  return (
    <>
      <AppRouter />
      <InstallAppBanner />
    </>
  )
}
