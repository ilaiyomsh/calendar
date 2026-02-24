import React, { useEffect, useState, Suspense } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import MondayCalendar from "./MondayCalendar";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { MondayProvider, useMondayContext, useMobile } from "./contexts/MondayContext";
const SettingsDialog = React.lazy(() => import("./components/SettingsDialog/SettingsDialog"));
const Dashboard = React.lazy(() => import("./components/Dashboard/Dashboard"));
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/Toast";
import ErrorDetailsModal from "./components/ErrorDetailsModal/ErrorDetailsModal";
import { setGlobalErrorHandler } from "./utils/globalErrorHandler";
import StopwatchLoader from "./components/StopwatchLoader";
import loaderStyles from "./components/StopwatchLoader/StopwatchLoader.module.css";

const monday = mondaySdk();

// זמן תחילת טעינת האפליקציה - משותף בין App loader ל-MondayCalendar loader
const appLoadStart = Date.now();

// רכיב פנימי שמשתמש ב-Settings Context
const AppContent = () => {
  const { customSettings, isLoading } = useSettings();
  const { context, isMobile } = useMondayContext();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState('calendar');
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
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#ffffff', gap: '16px' }}>
        <StopwatchLoader size={80} />
        <p className={loaderStyles.brandText}>Powered by Twyst</p>
      </div>
    );
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
        {!isMobile && isSettingsOpen && (
          <Suspense fallback={null}>
            <SettingsDialog
              monday={monday}
              context={context}
              onClose={() => setIsSettingsOpen(false)}
            />
          </Suspense>
        )}

      {/* רכיב הלוח / דשבורד */}
      <main className="app-main">
        {currentView === 'calendar' ? (
          <MondayCalendar
            monday={monday}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSwitchToDashboard={() => setCurrentView('dashboard')}
            appLoadStart={appLoadStart}
          />
        ) : (
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><StopwatchLoader size={80} /></div>}>
            <Dashboard
              monday={monday}
              onSwitchToCalendar={() => setCurrentView('calendar')}
              onOpenSettings={() => setIsSettingsOpen(true)}
              isOwner={true}
            />
          </Suspense>
        )}
      </main>
      </div>
    </ErrorBoundary>
  );
};

// רכיב App הראשי שעוטף הכל ב-MondayProvider
const App = () => {
  return (
    <MondayProvider monday={monday}>
      <SettingsProvider monday={monday}>
        <AppContent />
      </SettingsProvider>
    </MondayProvider>
  );
};

export default App;

