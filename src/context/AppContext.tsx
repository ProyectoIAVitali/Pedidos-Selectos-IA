import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UsuarioMovil,
  Cliente,
  CartItem,
  Producto,
} from '../types/database';
import { DatabaseService, getSupabaseCredentials } from '../lib/supabase';

export type MainTab = 'nuevo-pedido' | 'mis-pedidos' | 'catalogos' | 'perfil-sala';
export type CatalogTab = 'rutas' | 'supervisores' | 'clientes' | 'productos' | 'usuarios';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  // Autenticación
  currentUser: UsuarioMovil | null;
  assignedSalas: Cliente[];
  activeSala: Cliente | null;
  isAuthenticated: boolean;
  needsSalaSelection: boolean;
  isLoadingAuth: boolean;
  loginUser: (email: string) => Promise<{ success: boolean; multipleSalas: boolean; error?: string }>;
  selectSala: (codCliente: string) => void;
  logout: () => void;
  switchUser: (email: string) => Promise<void>;

  // Carrito de compras
  cart: CartItem[];
  addToCart: (producto: Producto, cantidad?: number) => void;
  updateCartQty: (codProducto: string, deltaOrQty: number, isAbsolute?: boolean) => void;
  removeFromCart: (codProducto: string) => void;
  clearCart: () => void;
  getCartTotalUnits: () => number;
  getCartDistinctCount: () => number;

  // Navegación
  currentTab: MainTab;
  setCurrentTab: (tab: MainTab) => void;
  currentCatalogTab: CatalogTab;
  setCurrentCatalogTab: (tab: CatalogTab) => void;

  // Notificaciones Toast
  toasts: ToastMessage[];
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  dismissToast: (id: string) => void;

  // Estado de Supabase
  isSupabaseConfigured: boolean;
  checkSupabaseStatus: () => boolean;
  showConfigModal: boolean;
  setShowConfigModal: (show: boolean) => void;

  // Forzar refresco global de catálogos
  dataVersion: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UsuarioMovil | null>(null);
  const [assignedSalas, setAssignedSalas] = useState<Cliente[]>([]);
  const [activeSala, setActiveSala] = useState<Cliente | null>(null);
  const [needsSalaSelection, setNeedsSalaSelection] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Carrito vacío sin datos simulados
  const [cart, setCart] = useState<CartItem[]>([]);

  const [currentTab, setCurrentTab] = useState<MainTab>('nuevo-pedido');
  const [currentCatalogTab, setCurrentCatalogTab] = useState<CatalogTab>('clientes');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(1);

  const checkSupabaseStatus = () => {
    const { url, key } = getSupabaseCredentials();
    const hasCreds = !!url && !!key;
    setIsSupabaseConfigured(hasCreds);
    return hasCreds;
  };

  // Inicialización conectando directamente a Supabase
  useEffect(() => {
    const init = async () => {
      setIsLoadingAuth(true);
      const configured = checkSupabaseStatus();

      if (!configured) {
        setIsLoadingAuth(false);
        setShowConfigModal(true);
        return;
      }

      // Priorizar:
      // 1. Email explícitamente guardado en sesión previa
      // 2. Cuenta de Google configurada o detectada
      const savedEmail = localStorage.getItem('rp_last_user_email');
      const googleAccount = localStorage.getItem('rp_google_account') || 'vportillovillela@gmail.com';
      const targetEmail = savedEmail || googleAccount;

      try {
        let foundUser: UsuarioMovil | null = null;
        if (targetEmail) {
          try {
            foundUser = await DatabaseService.getUsuarioByEmail(targetEmail);
          } catch {
            // continuar
          }
        }

        if (foundUser) {
          setCurrentUser(foundUser);
          localStorage.setItem('rp_last_user_email', foundUser.correo);

          let salas = await DatabaseService.getClientesForUsuario(foundUser.correo, foundUser).catch(() => []);

          // Si el usuario no tiene salas en usuarioClientes, consultar si hay clientes creados en public.Clientes
          if (salas.length === 0) {
            const allClientes = await DatabaseService.getClientes().catch(() => []);
            if (allClientes.length > 0) {
              salas = allClientes;
            }
          }

          setAssignedSalas(salas);

          if (salas.length > 1) {
            setNeedsSalaSelection(true);
            setActiveSala(salas[0]);
          } else if (salas.length === 1) {
            setActiveSala(salas[0]);
            setNeedsSalaSelection(false);
          }
        }
      } catch (err: any) {
        console.warn('Error inicial conectando a Supabase:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    init();
  }, [dataVersion]);

  const triggerRefresh = () => {
    setDataVersion((v) => v + 1);
    if (currentUser) {
      DatabaseService.getClientesForUsuario(currentUser.correo)
        .then(async (salas) => {
          let finalSalas = salas;
          if (finalSalas.length === 0) {
            finalSalas = await DatabaseService.getClientes().catch(() => []);
          }
          setAssignedSalas(finalSalas);
          if (activeSala) {
            const stillExists = finalSalas.find((s) => s.codCliente === activeSala.codCliente);
            if (!stillExists && finalSalas.length > 0) {
              setActiveSala(finalSalas[0]);
            }
          }
        })
        .catch((err) => console.error('Error refrescando salas:', err));
    }
  };

  const showToast = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'success'
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Autenticación de usuario consultando directamente usuariosMoviles en Supabase
  const loginUser = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const user = await DatabaseService.getUsuarioByEmail(cleanEmail);

      if (!user) {
        return {
          success: false,
          multipleSalas: false,
          error: `El correo "${email}" no fue encontrado en la tabla usuariosmoviles de Supabase.`,
        };
      }

      setCurrentUser(user);
      localStorage.setItem('rp_last_user_email', user.correo);

      let salas = await DatabaseService.getClientesForUsuario(user.correo, user).catch(() => []);
      if (salas.length === 0) {
        const allClientes = await DatabaseService.getClientes().catch(() => []);
        if (allClientes.length > 0) {
          salas = allClientes;
        }
      }

      setAssignedSalas(salas);

      if (salas.length > 1) {
        setNeedsSalaSelection(true);
        setActiveSala(salas[0]);
        return { success: true, multipleSalas: true };
      } else if (salas.length === 1) {
        setActiveSala(salas[0]);
        setNeedsSalaSelection(false);
        return { success: true, multipleSalas: false };
      } else {
        setActiveSala(null);
        setNeedsSalaSelection(false);
        return { success: true, multipleSalas: false };
      }
    } catch (err: any) {
      return {
        success: false,
        multipleSalas: false,
        error: err.message || 'Error al validar usuario en Supabase',
      };
    }
  };

  const selectSala = (codCliente: string) => {
    const sala = assignedSalas.find((s) => s.codCliente === codCliente);
    if (sala) {
      setActiveSala(sala);
      setNeedsSalaSelection(false);
      showToast(
        'Sala Confirmada',
        `Operando en ${sala.nombreCliente} (${sala.codCliente})`,
        'success'
      );
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setAssignedSalas([]);
    setActiveSala(null);
    setNeedsSalaSelection(false);
    localStorage.removeItem('rp_last_user_email');
  };

  const switchUser = async (email: string) => {
    const result = await loginUser(email);
    if (result.success) {
      showToast('Sesión Iniciada', `Usuario ${email} autenticado en Supabase`, 'info');
    } else if (result.error) {
      showToast('Error de Autenticación', result.error, 'error');
    }
  };

  // Lógica del Carrito
  const addToCart = (producto: Producto, cantidad = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.producto.codProducto === producto.codProducto);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          cantidad: updated[idx].cantidad + cantidad,
        };
        return updated;
      }
      return [...prev, { producto, cantidad }];
    });
  };

  const updateCartQty = (codProducto: string, deltaOrQty: number, isAbsolute = false) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.producto.codProducto === codProducto);
      if (idx >= 0) {
        const newQty = isAbsolute ? deltaOrQty : prev[idx].cantidad + deltaOrQty;
        if (newQty <= 0) {
          return prev.filter((item) => item.producto.codProducto !== codProducto);
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], cantidad: newQty };
        return updated;
      }
      return prev;
    });
  };

  const removeFromCart = (codProducto: string) => {
    setCart((prev) => prev.filter((item) => item.producto.codProducto !== codProducto));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotalUnits = () => {
    return cart.reduce((acc, item) => acc + item.cantidad, 0);
  };

  const getCartDistinctCount = () => {
    return cart.length;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        assignedSalas,
        activeSala,
        isAuthenticated: !!currentUser,
        needsSalaSelection,
        isLoadingAuth,
        loginUser,
        selectSala,
        logout,
        switchUser,
        cart,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        getCartTotalUnits,
        getCartDistinctCount,
        currentTab,
        setCurrentTab,
        currentCatalogTab,
        setCurrentCatalogTab,
        toasts,
        showToast,
        dismissToast,
        isSupabaseConfigured,
        checkSupabaseStatus,
        showConfigModal,
        setShowConfigModal,
        dataVersion,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
