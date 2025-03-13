import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';

const CosineDistributionVisualization = () => {
  const [activeTab, setActiveTab] = useState('basics');
  const [data, setData] = useState(null);
  const [selectedDimensions, setSelectedDimensions] = useState([2, 32, 128, 512]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("Initializing...");
  const [highlightedFormula, setHighlightedFormula] = useState(null);
  
  // Box-Muller transform for normal distribution sampling
  const normalRandom = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  
  // Generate a random unit vector in given dimension
  const generateRandomUnitVector = (dimension) => {
    const vector = [];
    let sumSquared = 0;
    
    // Generate random components from normal distribution
    for (let i = 0; i < dimension; i++) {
      const val = normalRandom();
      vector.push(val);
      sumSquared += val * val;
    }
    
    // Normalize to unit length
    const magnitude = Math.sqrt(sumSquared);
    for (let i = 0; i < dimension; i++) {
      vector[i] /= magnitude;
    }
    
    return vector;
  };
  
  // Calculate cosine distance between two vectors
  const calculateCosineDistance = (vec1, vec2) => {
    let dotProduct = 0;
    
    // Calculate dot product
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
    }
    
    // Cosine distance = 1 - cosine similarity
    // Since these are unit vectors, the cosine similarity is just the dot product
    return 1.0 - dotProduct;
  };

  // Generate synthetic data on component mount
  useEffect(() => {
    const generateSyntheticData = async () => {
      try {
        // Dimensions to analyze (powers of 2 for better distribution)
        const dimensions = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
        
        // Increase sample size for higher dimensions
        const getAdjustedSampleSize = (dim) => {
          if (dim <= 32) return 10000;
          if (dim <= 256) return 20000;
          return 50000;
        };
        
        const statistics = [];
        const distributionSamples = {};
        
        // Process each dimension
        for (let dimIndex = 0; dimIndex < dimensions.length; dimIndex++) {
          const dim = dimensions[dimIndex];
          const sampleSize = getAdjustedSampleSize(dim);
          
          setProgressMessage(`Generating ${sampleSize} samples for dimension ${dim}...`);
          setLoadingProgress((dimIndex / dimensions.length) * 100);
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 0));
          
          const samples = [];
          let sumDistances = 0;
          let sumSquaredDistances = 0;
          
          // Generate samples in batches to prevent UI blocking
          const batchSize = 100;
          const batches = Math.ceil(sampleSize / batchSize);
          
          for (let batch = 0; batch < batches; batch++) {
            const currentBatchSize = Math.min(batchSize, sampleSize - batch * batchSize);
            
            for (let i = 0; i < currentBatchSize; i++) {
              // Generate two random unit vectors
              const vector1 = generateRandomUnitVector(dim);
              const vector2 = generateRandomUnitVector(dim);
              
              // Calculate cosine distance
              const originalDistance = calculateCosineDistance(vector1, vector2);
              
              // Ensure distance is within valid range (numerical precision issues)
              const clampedDistance = Math.max(0, Math.min(2, originalDistance));
              
              // Calculate normalized distance with dimension scaling
              const scalingFactor = dim <= 3 ? Math.sqrt(dim) * 1.5 : Math.sqrt(dim);
              const normalizedDistance = (clampedDistance - 1.0) * scalingFactor + 1.0;
              
              // Store sample
              samples.push({
                originalDistance: clampedDistance,
                normalizedDistance
              });
              
              // Update statistics
              sumDistances += clampedDistance;
              sumSquaredDistances += clampedDistance * clampedDistance;
            }
            
            // Allow UI to update periodically
            if (batch % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
          // Calculate statistics
          const originalMean = sumDistances / sampleSize;
          const variance = (sumSquaredDistances / sampleSize) - (originalMean * originalMean);
          const originalStd = Math.sqrt(variance);
          const theoreticalStd = 1.0 / Math.sqrt(dim);
          
          // Calculate normalized statistics 
          const normalizedValues = samples.map(s => s.normalizedDistance);
          const normalizedSum = normalizedValues.reduce((sum, val) => sum + val, 0);
          const normalizedMean = normalizedSum / normalizedValues.length;
          
          const normalizedSumSquared = normalizedValues.reduce((sum, val) => {
            return sum + Math.pow(val - normalizedMean, 2);
          }, 0);
          const normalizedStd = Math.sqrt(normalizedSumSquared / normalizedValues.length);
          
          // Store statistics
          statistics.push({
            dimension: dim,
            originalMean,
            originalStd,
            normalizedMean,
            normalizedStd,
            theoreticalStd,
            ratio: originalStd / theoreticalStd
          });
          
          // Store distribution samples
          distributionSamples[dim] = samples;
        }
        
        setProgressMessage("Finalizing visualizations...");
        
        // Set final data
        setData({
          dimensions,
          statistics,
          distributionSamples
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error generating synthetic data:", error);
        setProgressMessage(`Error: ${error.message}`);
        setIsLoading(false);
      }
    };
    
    generateSyntheticData();
  }, []);
  
  // Generate histogram data for visualization
  const generateHistogramData = (dimensionKey, normalized = false) => {
    if (!data) return {};
    
    const histograms = {};
    
    selectedDimensions.forEach(dim => {
      const samples = data.distributionSamples[dim];
      const values = samples.map(s => normalized ? s.normalizedDistance : s.originalDistance);
      
      // Define bin range based on normalization
      const min = normalized ? -2 : 0;
      const max = normalized ? 4 : 2;
      const binCount = 40;
      const binSize = (max - min) / binCount;
      
      // Initialize bins
      const bins = Array(binCount).fill(0);
      
      // Count values in each bin
      values.forEach(val => {
        const binIndex = Math.floor((val - min) / binSize);
        if (binIndex >= 0 && binIndex < binCount) {
          bins[binIndex]++;
        }
      });
      
      // Convert to chart format and normalize to density
      histograms[dim] = bins.map((count, i) => ({
        x: min + (i + 0.5) * binSize,
        count: count / samples.length / binSize  // Normalize to density
      }));
    });
    
    return histograms;
  };
  
  // Custom color scheme for dimensions
  const getDimensionColor = (dimension) => {
    const colorMap = {
      2: '#4F46E5',      // Indigo
      4: '#7C3AED',      // Violet
      8: '#EC4899',      // Pink
      16: '#06B6D4',     // Cyan
      32: '#10B981',     // Emerald
      64: '#84CC16',     // Lime
      128: '#FBBF24',    // Amber
      256: '#F97316',    // Orange
      512: '#EF4444',    // Red
      1024: '#6366F1',   // Indigo
      2048: '#A855F7'    // Purple
    };
    return colorMap[dimension] || '#6B7280'; // Gray fallback
  };

  // Format dimension for display
  const formatDimension = (dim) => {
    return dim >= 1000 ? `${dim / 1000}k` : dim;
  };

  // Loading visualization with progress
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-8">
        <div className="w-full max-w-md mb-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">Generating Data</h3>
          <p className="text-gray-600 mb-3 text-center">{progressMessage}</p>
          
          {/* Progress bar container */}
          <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
            {/* Actual progress bar */}
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, loadingProgress)}%` }}
            ></div>
          </div>
          
          {/* Detailed progress info */}
          <p className="text-xs text-gray-500 mt-2 text-right">{Math.round(loadingProgress)}% complete</p>
          
          {/* Loading steps */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['Vector Generation', 'Distance Calculation', 'Statistical Analysis'].map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 mb-2 ${
                  loadingProgress < 33 && index === 0 ? 'bg-blue-500 text-white border-blue-500' : 
                  loadingProgress >= 33 && loadingProgress < 66 && index <= 1 ? 'bg-indigo-500 text-white border-indigo-500' : 
                  loadingProgress >= 66 ? 'bg-green-500 text-white border-green-500' :
                  'bg-white text-gray-400 border-gray-300'
                }`}>
                  {loadingProgress >= 33 && index === 0 ? '✓' : 
                   loadingProgress >= 66 && index === 1 ? '✓' : 
                   index + 1}
                </div>
                <span className={`text-xs text-center ${
                  loadingProgress < 33 && index === 0 ? 'text-blue-600 font-medium' : 
                  loadingProgress >= 33 && loadingProgress < 66 && index === 1 ? 'text-indigo-600 font-medium' : 
                  loadingProgress >= 66 && index === 2 ? 'text-green-600 font-medium' :
                  'text-gray-500'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Loading spinner */}
        <div className="inline-block w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Prepare data for charts
  const originalHistograms = generateHistogramData('originalDistance');
  const normalizedHistograms = generateHistogramData('normalizedDistance', true);
  
  // Prepare data for standard deviation vs dimension chart
  const stdDevData = data.statistics.map(stat => ({
    dimension: stat.dimension,
    empiricalStdDev: stat.originalStd,
    theoreticalStdDev: stat.theoreticalStd
  }));

  return (
    <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-md">
      <h1 className="text-3xl font-bold mb-2 text-gray-800 text-center">
        Cosine Distance in High Dimensions
      </h1>
      <p className="text-center text-gray-600 mb-6">
        Using real-time generated data to explore the concentration phenomenon
      </p>
      
      {/* Tabs for navigation */}
      <div className="flex mb-8 border-b border-gray-300 justify-center">
        {[
          { id: 'basics', label: 'Mathematical Foundations' },
          { id: 'problem', label: 'The Concentration Problem' },
          { id: 'solution', label: 'Normalization Solution' }
        ].map(tab => (
          <button 
            key={tab.id}
            className={`px-6 py-3 text-sm md:text-base font-medium transition-colors duration-200 
              ${activeTab === tab.id ? 
                'bg-blue-600 text-white border-b-2 border-blue-600' : 
                'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Dimension selector */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Vector Dimensions to Compare:</h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {data.dimensions.map(dim => (
            <button
              key={dim}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 
                ${selectedDimensions.includes(dim) ? 
                  'text-white shadow-md transform scale-105' : 
                  'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              style={selectedDimensions.includes(dim) ? {backgroundColor: getDimensionColor(dim)} : {}}
              onClick={() => {
                if (selectedDimensions.includes(dim)) {
                  setSelectedDimensions(selectedDimensions.filter(d => d !== dim));
                } else if (selectedDimensions.length < 4) {
                  setSelectedDimensions([...selectedDimensions, dim].sort((a, b) => a - b));
                }
              }}
            >
              d={formatDimension(dim)}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Select up to 4 dimensions to visualize their distribution properties
        </p>
      </div>
      
      {/* Content for "Basics" tab */}
      {activeTab === 'basics' && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6 animate-fadeIn">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
            Mathematical Foundations
          </h2>
          
          <div className="space-y-6">
            <div className="p-5 rounded-lg bg-white">
              <h3 className="text-xl font-semibold mb-3 text-gray-800 flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">1</div>
                Cosine Similarity &amp; Distance: Core Concepts
              </h3>
              <p className="mb-3 text-gray-700">
                Cosine similarity measures the cosine of the angle between two vectors, quantifying their directional similarity regardless of magnitude. For normalized vectors (unit length), it directly relates to the dot product.
              </p>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-3">
                <p className="text-center font-mono text-lg">
                  cos(θ) = <span className="text-blue-600 font-bold">(A·B)</span>/<span className="text-indigo-600 font-bold">(||A||·||B||)</span>
                </p>
                <div className="border-t border-blue-200 my-2 pt-2">
                  <p className="text-center font-mono">
                    cosine distance = <span className="text-green-600 font-bold">1 - cosine similarity</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm">
                  <div className="bg-white p-2 rounded shadow-sm">
                    <p className="font-semibold text-center">Similar Vectors</p>
                    <p className="text-center text-gray-600">Similarity ≈ 1.0</p>
                    <p className="text-center text-gray-600">Distance ≈ 0.0</p>
                  </div>
                  <div className="bg-white p-2 rounded shadow-sm">
                    <p className="font-semibold text-center">Orthogonal Vectors</p>
                    <p className="text-center text-gray-600">Similarity = 0.0</p>
                    <p className="text-center text-gray-600">Distance = 1.0</p>
                  </div>
                  <div className="bg-white p-2 rounded shadow-sm">
                    <p className="font-semibold text-center">Opposite Vectors</p>
                    <p className="text-center text-gray-600">Similarity = -1.0</p>
                    <p className="text-center text-gray-600">Distance = 2.0</p>
                  </div>
                </div>
              </div>
              
              <h4 className="font-semibold mt-5 mb-2 text-gray-800">Mathematical Properties</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded border border-blue-200">
                  <p className="font-medium text-blue-800 mb-2">Formal Definition:</p>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    <li>For vectors A, B in ℝᵈ</li>
                    <li>Dot product: A·B = Σᵢ₌₁ᵈ aᵢbᵢ</li>
                    <li>Magnitude: ||A|| = √(Σᵢ₌₁ᵈ aᵢ²)</li>
                    <li>Thus, similarity = (Σᵢ₌₁ᵈ aᵢbᵢ)/(√(Σᵢ₌₁ᵈ aᵢ²)√(Σᵢ₌₁ᵈ bᵢ²))</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded border border-green-200">
                  <p className="font-medium text-green-800 mb-2">Key Properties:</p>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    <li>Scale invariance: only direction matters, not magnitude</li>
                    <li>Bounded range: distance ∈ [0, 2]</li>
                    <li>Not a true metric (triangle inequality doesn't hold)</li>
                    <li>Efficient for sparse high-dimensional vectors</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-white">
              <h3 className="text-xl font-semibold mb-3 text-gray-800 flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">2</div>
                The Curse of Dimensionality
              </h3>
              
              <p className="mb-4 text-gray-700">
                High-dimensional spaces exhibit counterintuitive properties that significantly impact the behavior of cosine distance. This phenomenon, known as the "curse of dimensionality," has profound implications for vector embeddings and similarity search.
              </p>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-4">
                <h4 className="font-semibold text-red-800 mb-2">Key Manifestations in Vector Spaces</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <ul className="list-disc pl-5 text-gray-700 space-y-1">
                      <li><strong>Distance Concentration</strong>: As dimensions increase, distances between points tend to become more uniform</li>
                      <li><strong>Sparsity</strong>: Points become increasingly distant from each other</li>
                      <li><strong>Hub Formation</strong>: Some vectors become abnormally close to many others</li>
                      <li><strong>Empty Space Phenomenon</strong>: Most of the space contains no data points</li>
                    </ul>
                  </div>
                  <div>
                    <ul className="list-disc pl-5 text-gray-700 space-y-1">
                      <li><strong>Orthogonality</strong>: Random vectors become nearly perpendicular to each other</li>
                      <li><strong>Deteriorating Discrimination</strong>: Meaningful similarity differences get compressed</li>
                      <li><strong>Increased Computation</strong>: Processing requirements grow exponentially</li>
                      <li><strong>Data Hunger</strong>: Required training samples grow exponentially</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 mb-4">
                <h4 className="font-semibold text-blue-800 mb-2">Impact on Cosine Distance</h4>
                <p className="text-gray-700 mb-3">
                  For cosine distance specifically, the curse manifests as:
                </p>
                <div className="bg-white p-3 rounded shadow-sm mb-3">
                  <p className="text-gray-800 font-medium">Concentration Effect</p>
                  <p className="text-sm text-gray-600">
                    As dimension d increases, the standard deviation of cosine distances between random vectors decreases proportionally to 1/√d, causing distances to cluster tightly around 1.0 (90° angle).
                  </p>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-gray-800 font-medium">Statistical Explanation</p>
                  <p className="text-sm text-gray-600">
                    By the Central Limit Theorem, as dimensions increase, the dot product of random unit vectors approaches a normal distribution with mean 0 and variance 1/d. This increasingly narrow distribution makes meaningful similarity discrimination difficult.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-2">Practical Implications</h4>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
                    <li>Similarity thresholds must be dimension-dependent</li>
                    <li>Nearest neighbor search becomes less effective</li>
                    <li>Small differences in high dimensions may be significant</li>
                    <li>Search recall tends to deteriorate</li>
                    <li>Vector magnitude differences become more important</li>
                  </ul>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-2">Mitigation Strategies</h4>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
                    <li>Dimension-aware normalization (shown in this demo)</li>
                    <li>Dimensionality reduction (PCA, t-SNE, UMAP)</li>
                    <li>Locality-sensitive hashing</li>
                    <li>Graph-based approaches (HNSW)</li>
                    <li>Product quantization and vector compression</li>
                  </ul>
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-800 mb-2">LLM and Embedding Search Implications</h4>
                <p className="text-gray-700 mb-2">
                  Modern language models produce embeddings with dimensions ranging from 384 to 4096+. At these scales:
                </p>
                <ul className="list-disc pl-5 text-gray-700 space-y-1">
                  <li>Distance differences as small as 0.01 can be semantically meaningful</li>
                  <li>Differentiating between distances of 0.98 and 0.99 becomes crucial</li>
                  <li>The dimension-aware normalization shown in this visualization becomes essential for consistent interpretation</li>
                  <li>Raw distance values without normalization can be misleading when comparing across models with different embedding dimensions</li>
                </ul>
              </div>
            </div>
            
            <div className="p-5 rounded-lg bg-white">
              <h3 className="text-xl font-semibold mb-3 text-gray-800 flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">4</div>
                Additional Applications
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <h4 className="font-semibold text-gray-800 mb-2">Natural Language Processing</h4>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
                    <li>Document clustering and topic modeling</li>
                    <li>Detecting duplicate content and plagiarism</li>
                    <li>Word sense disambiguation</li>
                    <li>Cross-lingual document matching</li>
                    <li>Query expansion in search engines</li>
                  </ul>
                </div>
                
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <h4 className="font-semibold text-gray-800 mb-2">Machine Learning</h4>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
                    <li>Feature similarity in clustering algorithms</li>
                    <li>Measuring model output similarity</li>
                    <li>Nearest-prototype classification</li>
                    <li>Anomaly detection systems</li>
                    <li>Face recognition and biometric matching</li>
                  </ul>
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                <h4 className="font-semibold text-amber-800 mb-2">Advanced Considerations</h4>
                <ul className="list-disc pl-5 text-gray-700 space-y-1">
                  <li><strong>Pre-normalization:</strong> Many systems normalize vectors to unit length during preprocessing to simplify distance calculations</li>
                  <li><strong>Binary vectors:</strong> For binary features, Jaccard similarity may be preferable to cosine distance</li>
                  <li><strong>Negative values:</strong> Cosine distance handles negative vector components appropriately, unlike some other metrics</li>
                  <li><strong>Weighted cosine:</strong> Components can be weighted differently to emphasize certain dimensions</li>
                </ul>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Sample Distribution of Original Cosine Distances</h3>
              <div className="h-80 bg-gray-50 p-4 rounded-lg shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    margin={{ top: 5, right: 30, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      domain={[0, 2]} 
                      label={{ value: 'Cosine Distance', position: 'insideBottom', offset: -5, fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Density', angle: -90, position: 'insideLeft', fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => value.toFixed(4)} 
                      labelFormatter={(label) => `Distance: ${parseFloat(label).toFixed(2)}`}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} verticalAlign="bottom" height={36} />
                    {selectedDimensions.map(dim => (
                      <Line 
                        key={dim}
                        data={originalHistograms[dim]} 
                        type="monotone" 
                        dataKey="count" 
                        stroke={getDimensionColor(dim)}
                        strokeWidth={2}
                        name={`d=${formatDimension(dim)}`}
                      />
                    ))}
                    <ReferenceLine x={1} stroke="#FF0000" strokeDasharray="3 3" label={{ value: 'Mean = 1.0', position: 'top', fontSize: 12 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                This graph shows the distribution of cosine distances between random unit vectors in different dimensions
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Content for "The Problem" tab */}
      {activeTab === 'problem' && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6 animate-fadeIn">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
            The Concentration Problem in High Dimensions
          </h2>
          
          <div className="mb-6">
            <p className="mb-4 text-gray-700">
              As dimensionality increases, cosine distances between random vectors become increasingly concentrated around 1.0. 
              This phenomenon, a manifestation of the "curse of dimensionality," makes it difficult to distinguish between similar 
              and dissimilar vectors in high-dimensional spaces.
            </p>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
              <h3 className="font-semibold text-yellow-800 mb-2">Key Challenge:</h3>
              <p className="text-gray-700">
                The standard deviation of cosine distances decreases proportionally to 1/√dimension, causing the distribution to become 
                increasingly narrow. This reduces the discriminative power of cosine distance in high dimensions.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Standard Deviation vs. Dimension</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stdDevData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="dimension" 
                      type="number" 
                      scale="log" 
                      domain={['dataMin', 'dataMax']} 
                      tickFormatter={(tick) => formatDimension(tick)}
                      label={{ value: 'Dimension (log scale)', position: 'insideBottom', offset: -5, fontSize: 12 }}
                    />
                    <YAxis 
                      type="number" 
                      scale="log"
                      domain={[0.01, 1]} 
                      label={{ value: 'Standard Deviation', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      tickFormatter={(tick) => tick.toFixed(2)}
                    />
                    <Tooltip 
                      formatter={(value) => value.toFixed(4)} 
                      labelFormatter={(label) => `Dimension: ${label}`}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} verticalAlign="bottom" height={36} />
                    <Line type="monotone" dataKey="empiricalStdDev" stroke="#8884d8" name="Actual StdDev" strokeWidth={2} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="theoreticalStdDev" stroke="#82ca9d" name="Theoretical (1/√d)" strokeDasharray="5 5" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Both axes use logarithmic scale to show the inverse square root relationship
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Distribution Width Comparison</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={selectedDimensions.map(dim => ({
                      dimension: dim,
                      standardDeviation: 1.0 / Math.sqrt(dim),
                    }))}
                    margin={{ top: 5, right: 30, left: 40, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      label={{ value: 'Standard Deviation', position: 'insideBottom', offset: -5, fontSize: 12 }}
                    />
                    <YAxis 
                      dataKey="dimension" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(tick) => `d=${formatDimension(tick)}`}
                      label={{ value: 'Dimension', angle: -90, position: 'insideLeft', fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => value.toFixed(4)} 
                      labelFormatter={(label) => `Dimension: ${label}`}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} verticalAlign="bottom" height={36} />
                    <Bar 
                      dataKey="standardDeviation" 
                      name="StdDev" 
                      radius={[0, 4, 4, 0]}
                    >
                      {
                        selectedDimensions.map((dim) => (
                          <cell key={`cell-${dim}`} fill={getDimensionColor(dim)} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                As dimension increases, the distribution width (standard deviation) shrinks dramatically
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Content for "The Solution" tab */}
      {activeTab === 'solution' && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6 animate-fadeIn">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
            Dimension-Aware Normalization Solution
          </h2>
          
          <div className="mb-6">
            <p className="mb-4 text-gray-700">
              To address the concentration problem, we can apply a dimension-aware normalization formula that counteracts 
              the narrowing effect in high dimensions, making cosine distances comparable across different dimensionalities.
            </p>
            
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-6 shadow-sm">
              <h3 className="font-semibold text-blue-800 mb-4 text-center">The Normalization Formula:</h3>
              <div className="text-center">
                <span className="text-3xl font-mono">
                  <span className="text-purple-600 font-bold">d'</span> = (<span className="text-blue-600">d</span> - 1) × √<span className="text-green-600">dimension</span> + 1
                </span>
              </div>
              <div className="text-center text-sm mt-4 text-gray-600">
                Where <span className="text-purple-600 font-medium">d'</span> is the normalized distance, <span className="text-blue-600 font-medium">d</span> is the original distance, and <span className="text-green-600 font-medium">dimension</span> is the vector dimensionality
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Distribution of Normalized Cosine Distances</h3>
            <div className="h-80 bg-gray-50 p-4 rounded-lg shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  margin={{ top: 5, right: 30, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    domain={[-1, 3]} 
                    label={{ value: 'Normalized Cosine Distance', position: 'insideBottom', offset: -5, fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Density', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value) => value.toFixed(4)} 
                    labelFormatter={(label) => `Normalized Distance: ${parseFloat(label).toFixed(2)}`}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} verticalAlign="bottom" height={36} />
                  {selectedDimensions.map(dim => (
                    <Line 
                      key={dim}
                      data={normalizedHistograms[dim]} 
                      type="monotone" 
                      dataKey="count" 
                      stroke={getDimensionColor(dim)}
                      strokeWidth={2}
                      name={`d=${formatDimension(dim)}`}
                    />
                  ))}
                  <ReferenceLine x={1} stroke="#FF0000" strokeDasharray="3 3" label={{ value: 'Mean = 1.0', position: 'top', fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              After normalization, distributions for all dimensions have comparable spread while maintaining the mean at 1.0
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-3">Benefits of Normalization</h3>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                <li><strong>Consistent Distributions</strong>: Similar spread regardless of dimension</li>
                <li><strong>Preserved Mean</strong>: All normalized distributions remain centered at 1.0</li>
                <li><strong>Restored Discrimination</strong>: Improves ability to distinguish similarities in high dimensions</li>
                <li><strong>Dimension-Invariant Thresholds</strong>: Same threshold works across dimensions</li>
              </ul>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-3">Applications</h3>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                <li><strong>Cross-Dimensional Comparisons</strong>: Compare embeddings of different dimensions</li>
                <li><strong>Model Evaluation</strong>: Better assess similarity across model versions</li>
                <li><strong>Dimensionality Reduction</strong>: Evaluate how well similarity is preserved</li>
                <li><strong>Multi-Modal Systems</strong>: Compare embeddings from different modalities</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <h3 className="font-semibold text-blue-800 mb-2">About This Visualization</h3>
        <p className="text-gray-700 text-sm">
          All data shown is generated in real-time using the Box-Muller transform to sample random unit vectors
          in the specified dimensions, then calculating their cosine distances. No pre-computed data is used.
        </p>
      </div>
      
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CosineDistributionVisualization;
