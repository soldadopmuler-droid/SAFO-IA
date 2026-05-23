import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound.tsx";

// Rotas autenticadas — carregadas sob demanda para reduzir o bundle inicial.
// Dashboard puxa recharts (~221 KB) e Apostila puxa jspdf (~165 KB).
const Dashboard = lazy(() => import("./pages/study/Dashboard"));
const Tutor = lazy(() => import("./pages/study/Tutor"));
const Questoes = lazy(() => import("./pages/study/Questoes"));
const Flashcards = lazy(() => import("./pages/study/Flashcards"));
const Apostila = lazy(() => import("./pages/study/Apostila"));
const Resumo = lazy(() => import("./pages/study/Resumo"));
const Materias = lazy(() => import("./pages/study/Materias"));
const Podcasts = lazy(() => import("./pages/study/Podcasts"));
const BibliotecaAudio = lazy(() => import("./pages/study/BibliotecaAudio"));
const Marca = lazy(() => import("./pages/Marca"));
const Legislacao = lazy(() => import("./pages/study/Legislacao"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminMaterias = lazy(() => import("./pages/AdminMaterias"));
const AdminProgresso = lazy(() => import("./pages/AdminProgresso"));

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tutor" element={<Tutor />} />
                <Route path="/questoes" element={<Questoes />} />
                <Route path="/flashcards" element={<Flashcards />} />
                <Route path="/apostila" element={<Apostila />} />
                <Route path="/resumo" element={<Resumo />} />
                <Route path="/materias" element={<Materias />} />
                <Route path="/podcasts" element={<Podcasts />} />
                <Route path="/biblioteca-audio" element={<BibliotecaAudio />} />
                <Route path="/marca" element={<Marca />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/materias" element={<AdminMaterias />} />
                <Route path="/admin/progresso" element={<AdminProgresso />} />
                <Route path="/legislacao" element={<Legislacao />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
