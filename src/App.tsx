import { useStore } from './lib/store';
import SplashScreen from './pages/SplashScreen';
import LoginScreen from './pages/auth/LoginScreen';
import RegisterScreen from './pages/auth/RegisterScreen';
import VerifyScreen from './pages/auth/VerifyScreen';
import PinScreen from './pages/auth/PinScreen';
import TradingPlatform from './pages/TradingPlatform';

export default function App() {
  const screen = useStore(s => s.screen);
  const theme = useStore(s => s.theme);

  return (
    <div className={`app ${theme}`}>
      {screen === 'splash'   && <SplashScreen />}
      {screen === 'login'    && <LoginScreen />}
      {screen === 'register' && <RegisterScreen />}
      {screen === 'verify'   && <VerifyScreen />}
      {screen === 'pin'      && <PinScreen />}
      {screen === 'trading'  && <TradingPlatform />}
    </div>
  );
}
