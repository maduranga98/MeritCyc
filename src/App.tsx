import { Logo } from "./components/Logo";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <div className="min-h-screen bg-merit-bg p-8 font-brand">
      <header className="flex justify-between items-center mb-12 border-b pb-6 border-gray-200">
        <Logo /> {/* Logo component එක මෙතනට */}
        <button className="bg-merit-navy text-white px-6 py-2.5 rounded-lg hover:bg-opacity-95 transition">
          Dashboard Login
        </button>
      </header>

      <LoginPage />
    </div>
  );
}
export default App;
