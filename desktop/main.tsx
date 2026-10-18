import {createRoot} from 'react-dom/client';
import '../app/globals.css';
import '@fontsource/noto-sans-georgian/400.css';
import '@fontsource/noto-sans-georgian/700.css';
import PosWorkspace from '@/components/pos-workspace';
import {desktopPlatform} from './platform';

createRoot(document.getElementById('root')!).render(<PosWorkspace mode="demo" platform={desktopPlatform}/>);
