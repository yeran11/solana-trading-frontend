import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-solana': ['@solana/web3.js', '@solana/spl-token'],
          'vendor-ui': ['lucide-react', 'framer-motion', 'react-split'],
          'vendor-utils': ['bs58', 'buffer', 'crypto-js', 'd3'],
          
          // Trading utilities - separate chunk for each DEX
          'trading-pump': [
            './src/utils/pumpbuy.ts',
            './src/utils/pumpsell.ts',
            './src/utils/pumpcreate.ts'
          ],
          'trading-moon': [
            './src/utils/moonbuy.ts', 
            './src/utils/moonsell.ts',
            './src/utils/mooncreate.ts'
          ],
          'trading-boop': [
            './src/utils/boopbuy.ts',
            './src/utils/boopsell.ts',
            './src/utils/boopcreate.ts'
          ],
          'trading-jupiter': [
            './src/utils/jupbuy.ts',
            './src/utils/jupsell.ts'
          ],
          'trading-raydium': [
            './src/utils/raybuy.ts',
            './src/utils/raysell.ts'
          ],
          'trading-launch': [
            './src/utils/launchbuy.ts',
            './src/utils/launchsell.ts'
          ],
          'trading-swap': [
            './src/utils/swapbuy.ts',
            './src/utils/swapsell.ts'
          ],
          'trading-other': [
            './src/utils/bonkcreate.ts',
            './src/utils/cookcreate.ts',
            './src/utils/cleaner.ts',
            './src/utils/consolidate.ts',
            './src/utils/distribute.ts',
            './src/utils/mixer.ts'
          ],
          
          // Modal components
          'modals': [
            './src/BurnModal.tsx',
            './src/CalculatePNLModal.tsx', 
            './src/DeployModal.tsx',
            './src/CleanerModal.tsx',
            './src/CustomBuyModal.tsx',
            './src/SettingsModal.tsx'
          ],
          
          // Page components
          'pages': [
            './src/Wallets.tsx',
            './src/Chart.tsx',
            './src/Actions.tsx',
            './src/Mobile.tsx'
          ],
          
          // Core components
          'components': [
            './src/WalletOverview.tsx',
            './src/FloatingTradingCard.tsx',
            './src/TradingForm.tsx',
            './src/PnlCard.tsx'
          ]
        },
        
        // Optimize chunk size
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        }
      }
    },
    
    // Optimize build performance
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // Set chunk size warning limit
    chunkSizeWarningLimit: 500
  },
  
  // Development server configuration
  server: {
    port: 3000,
    host: true
  }
});