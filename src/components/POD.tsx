import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, FileImage, Download, X } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import type { PODFile } from '../types';

const PODComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    billNo: '',
    vehicleNo: '',
    party: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { podFiles, addPODFile, setPODFiles } = useDataStore();

  // Force refresh POD data on component mount to ensure data persistence
  useEffect(() => {
    const refreshPODData = async () => {
      try {
        console.log('🔄 Refreshing POD data on component mount...');
        const response = await apiService.getPODFiles();
        if (response.podFiles) {
          setPODFiles(response.podFiles);
          console.log('✅ POD data refreshed:', response.podFiles.length, 'files');
        }
      } catch (error) {
        console.error('❌ Failed to refresh POD data:', error);
      }
    };
    
    refreshPODData();
  }, [setPODFiles]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
        const newPOD: PODFile = {
          id: `pod-${Date.now()}`,
          filename: file.name,
          fileData: fileData, // Base64 encoded file data
          fileType: file.type,
          billNo: uploadData.billNo || undefined,
          vehicleNo: uploadData.vehicleNo || undefined,
          party: uploadData.party || undefined,
          uploadDate: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        
        // Save POD to backend first
        try {
          await apiService.createPODFile(newPOD);
          console.log('POD file saved to backend successfully');
          
          // Add to local store
          addPODFile(newPOD);
        } catch (error) {
          console.error('Failed to save POD to backend:', error);
          // Still add to local store as fallback
          addPODFile(newPOD);
        }
        
        setShowUploadModal(false);
        setUploadData({ billNo: '', vehicleNo: '', party: '' });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  const filteredPODs = podFiles.filter(pod => 
    pod.billNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.vehicleNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.party?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownloadPOD = (pod: PODFile) => {
    try {
      // Create a download link for the base64 encoded file
      const link = document.createElement('a');
      link.href = pod.fileData;
      link.download = pod.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading POD:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">POD (Proof of Delivery)</h1>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Upload className="w-5 h-5" />
          <span>Upload POD</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by Bill No, Vehicle No, Party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Search
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload POD</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bill Number (Optional)
                </label>
                <input
                  type="text"
                  value={uploadData.billNo}
                  onChange={(e) => setUploadData(prev => ({ ...prev, billNo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter bill number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number (Optional)
                </label>
                <input
                  type="text"
                  value={uploadData.vehicleNo}
                  onChange={(e) => setUploadData(prev => ({ ...prev, vehicleNo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter vehicle number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Party Name (Optional)
                </label>
                <input
                  type="text"
                  value={uploadData.party}
                  onChange={(e) => setUploadData(prev => ({ ...prev, party: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter party name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POD Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">POD Images ({filteredPODs.length})</h3>
        </div>
        <div className="p-6">
          {filteredPODs.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <FileImage className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No POD images found</p>
              <p className="text-sm">Upload POD images to attach with bills</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPODs.map((pod) => (
                <div key={pod.id || `pod-${pod.filename}-${pod.uploadDate}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <FileImage className="w-8 h-8 text-blue-600" />
                    <button 
                      onClick={() => handleDownloadPOD(pod)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Download POD"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-medium text-gray-900 truncate">{pod.filename}</h4>
                  <div className="text-sm text-gray-500 mt-2 space-y-1">
                    {pod.billNo && <p>Bill: {pod.billNo}</p>}
                    {pod.vehicleNo && <p>Vehicle: {pod.vehicleNo}</p>}
                    {pod.party && <p>Party: {pod.party}</p>}
                    <p>Uploaded: {new Date(pod.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PODComponent;