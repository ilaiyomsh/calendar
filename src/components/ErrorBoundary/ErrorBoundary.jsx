import React from 'react';
import { parseMondayError, createFullErrorObject } from '../../utils/errorHandler';
import logger from '../../utils/logger';

/**
 * Error Boundary - תופס שגיאות React שלא טופלו
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error('ErrorBoundary', 'React error caught', error);
        this.setState({ error, errorInfo });
        
        // אם יש onError callback, נקרא לו
        if (this.props.onError) {
            const parsedError = parseMondayError(error);
            const fullErrorObject = createFullErrorObject(parsedError, 'ErrorBoundary', Date.now(), null);
            this.props.onError(fullErrorObject);
        }
    }

    render() {
        if (this.state.hasError) {
            // אם יש fallback UI, נציג אותו
            if (this.props.fallback) {
                return this.props.fallback;
            }
            
            // אחרת, נציג הודעת שגיאה פשוטה
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h2>אירעה שגיאה</h2>
                    <p>אנא רענן את הדף או פנה לתמיכה.</p>
                    {this.state.error && (
                        <details style={{ marginTop: '20px', textAlign: 'right', direction: 'rtl' }}>
                            <summary>פרטי שגיאה</summary>
                            <pre style={{ 
                                background: '#f5f5f5', 
                                padding: '10px', 
                                borderRadius: '4px',
                                overflow: 'auto',
                                maxHeight: '200px'
                            }}>
                                {this.state.error.toString()}
                                {this.state.errorInfo && (
                                    <>
                                        {'\n\n'}
                                        {this.state.errorInfo.componentStack}
                                    </>
                                )}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

