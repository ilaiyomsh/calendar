import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import MondayCalendar from "./MondayCalendar";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { MobileProvider, useMobile } from "./contexts/MobileContext";
import SettingsDialog from "./components/SettingsDialog/SettingsDialog";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/Toast";
import ErrorDetailsModal from "./components/ErrorDetailsModal/ErrorDetailsModal";
import { setGlobalErrorHandler } from "./utils/globalErrorHandler";

const monday = mondaySdk();

// רכיב פנימי שמשתמש ב-Settings Context
const AppContent = ({ context }) => {
  const { customSettings, isLoading } = useSettings();
  const isMobile = useMobile();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dialogRef = useRef(null);

  // Toast management
  const {
    toasts,
    removeToast,
    showErrorWithDetails,
    errorDetailsModal,
    openErrorDetailsModal,
    closeErrorDetailsModal
  } = useToast();

  // הגדרת global error handler
  useEffect(() => {
    setGlobalErrorHandler(showErrorWithDetails);
  }, [showErrorWithDetails]);




  if (isLoading) {
    return 
  }

  return (
    <ErrorBoundary 
      onError={(errorDetails) => {
        openErrorDetailsModal(errorDetails);
      }}
    >
      <div className="App">
        {/* Toast Notifications - גלובלי */}
        <ToastContainer 
          toasts={toasts} 
          onRemove={removeToast}
          onShowErrorDetails={openErrorDetailsModal}
        />
        
        {/* Error Details Modal - גלובלי */}
        <ErrorDetailsModal
          isOpen={!!errorDetailsModal}
          onClose={closeErrorDetailsModal}
          errorDetails={errorDetailsModal}
        />
        
        {/* דיאלוג ההגדרות - מרונדר רק כשפתוח, מוסתר במובייל */}
        {!isMobile && isSettingsOpen ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10005,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsSettingsOpen(false);
        }}>
          <dialog
            ref={dialogRef}
            open
            style={{
              position: 'relative',
              margin: 0,
              padding: 0,
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              width: '90%',
              maxWidth: '500px',
              height: '80vh',
              maxHeight: '800px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'white'
            }}
          >
            {/* כותרת קבועה */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fafbfc',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>הגדרות האפליקציה</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            {/* תוכן גלילתי */}
            <SettingsDialog 
              monday={monday}
              context={context}
              onClose={() => setIsSettingsOpen(false)}
            />
          </dialog>
        </div>
      ) : null}

      {/* רכיב הלוח */}
      <main className="app-main">
        <MondayCalendar 
          monday={monday} 
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </main>
      </div>
    </ErrorBoundary>
  );
};

// רכיב App הראשי שעוטף הכל ב-SettingsProvider
const App = () => {
  const [context, setContext] = useState(null);

  // טעינת context מ-Monday SDK
  useEffect(() => {
    monday.get('context').then(res => {
      if (res.data) {
        setContext(res.data);
      }
    });
  }, []);

  return (
    <MobileProvider context={context}>
      <SettingsProvider monday={monday}>
        <AppContent context={context} />
      </SettingsProvider>
    </MobileProvider>
  );
};

export default App;

