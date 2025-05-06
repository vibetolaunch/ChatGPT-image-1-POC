// Configuration settings for the application
interface FeatureFlags {
  showTokenPurchase: boolean;
}

// Feature flags that control application behavior
export const featureFlags: FeatureFlags = {
  // Set to false to hide the token purchase UI
  showTokenPurchase: false,
};

// Other configuration settings can be added here 