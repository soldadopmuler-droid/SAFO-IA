import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Home, MessageCircle, ClipboardList, BookOpen, FileText, Library,
  LayoutDashboard, Layers, Headphones, ListMusic, Scale, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Início",           url: "/",                icon: Home },
  { title: "Dashboard",        url: "/dashboard",       icon: LayoutDashboard },
  { title: "Tutor IA",         url: "/tutor",           icon: MessageCircle },
  { title: "Questões",         url: "/questoes",        icon: ClipboardList },
  { title: "Flashcards",       url: "/flashcards",      icon: Layers },
  { title: "Apostila",         url: "/apostila",        icon: BookOpen },
  { title: "Resumo",           url: "/resumo",          icon: FileText },
  { title: "Podcasts",         url: "/podcasts",        icon: Headphones },
  { title: "Biblioteca Áudio", url: "/biblioteca-audio",icon: ListMusic },
  { title: "Materiais",        url: "/materias",        icon: Library },
  { title: "Legislação",       url: "/legislacao",      icon: Scale },
];

const adminItems = [
  { title: "Painel Admin",     url: "/admin",           icon: Shield },
  { title: "Matérias",         url: "/admin/materias",  icon: Library },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <BrandLogo size={40} className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_2px_8px_hsl(var(--primary)/0.35)]" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-bold tracking-wide text-gradient-gold">Praça IA</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">CFP · PM-PR</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Estudo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {(user.email || "?").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-xs text-foreground">{user.email}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut} title="Sair">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          {!collapsed && <span>Praça IA online</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
