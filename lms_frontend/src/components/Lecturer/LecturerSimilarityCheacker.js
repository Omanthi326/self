import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import LecturerSidebar from "./LecturerSidebar";
import AssignmentSimilarityReport from "./AssignmentSimilarityReport";
import axios from "axios";
import { 
  FaDownload, 
  FaEye, 
  FaExclamationCircle, 
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaArrowLeft,
  FaTrash,
  FaGlobe,
  FaExchangeAlt,
  FaUpload,
  FaFile,
  FaFilePdf
} from "react-icons/fa";

function SimilarityChecker() {
  // Get assignment_id from URL parameters
  const { assignment_id } = useParams();
  
  const [files, setFiles] = useState([]);
  const [existingAssignments, setExistingAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("submissions");
  const [webResults, setWebResults] = useState(null);
  const [assignmentResults, setAssignmentResults] = useState(null);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(0); // Similarity threshold (0-100)
  const fileInputRef = useRef(null);
  
  // State for assignment details and submissions
  const [assignmentDetails, setAssignmentDetails] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [notification, setNotification] = useState(null);
  
  // State for detailed report viewing
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  const baseUrl = "http://127.0.0.1:8000/api";

  // Fetch submissions when component mounts
  useEffect(() => {
    if (assignment_id) {
      fetchSubmissions();
      fetchExistingAssignments();
    }
  }, [assignment_id]);

  // Fetch existing assignments from the backend
  const fetchExistingAssignments = async () => {
    try {
      const response = await axios.get(`${baseUrl}/list/`);
      if (response.data.status === 'success') {
        const assignments = response.data.assignments.map(assignment => ({
          ...assignment,
          selected: false
        }));
        setExistingAssignments(assignments);
      } else {
        console.error('Failed to fetch assignments:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  // Fetch submissions for this assignment
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching submissions for assignment ${assignment_id}`);
      
      // Use the correct endpoint with the assignment ID
      const response = await axios.get(`${baseUrl}/assignment-submissions/${assignment_id}/`);
      
      console.log("API response:", response.data); // Log the response for debugging
      
      // Check if the response has the expected structure
      if (response.data && response.data.status === 'success' && response.data.data) {
        // Extract assignment details
        if (response.data.data.assignment_title) {
          setAssignmentDetails({
            id: response.data.data.assignment_id,
            title: response.data.data.assignment_title,
            course_id: response.data.data.course_id 
            // Add other fields if available
          });
        }
        
        // Extract submissions
        if (response.data.data.submissions && Array.isArray(response.data.data.submissions)) {
          console.log(`Found ${response.data.data.submissions.length} submissions`);
          setSubmissions(response.data.data.submissions);
        } else {
          console.warn("No submissions array found in response");
          setSubmissions([]);
        }
      } else {
        // Try alternate data format
        if (Array.isArray(response.data)) {
          console.log("Response is an array, using directly");
          setSubmissions(response.data);
        } else {
          console.error('Unexpected response format:', response.data);
          setError('Unexpected response format from server');
        }
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setError(`Failed to load submissions for assignment ID: ${assignment_id}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
  };

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // Clear all files
  const clearFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload files to the backend
  const uploadFiles = async () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // Upload each file to the backend
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('title', file.name);
        formData.append('file', file);

        const response = await axios.post(`${baseUrl}/upload/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        return response.data;
      });

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);
      
      // Refresh the list of assignments
      fetchExistingAssignments();
      
      // Clear the selected files
      clearFiles();
      
      setLoading(false);
      return results;
    } catch (error) {
      setError(`Upload failed: ${error.response?.data?.message || error.message}`);
      setLoading(false);
      return [];
    }
  };

  // Toggle selection of existing assignments
  const toggleAssignmentSelection = (assignmentId) => {
    setExistingAssignments(prevAssignments => 
      prevAssignments.map(assignment => 
        assignment.id === assignmentId 
          ? { ...assignment, selected: !assignment.selected }
          : assignment
      )
    );
  };

  // Toggle submission selection
  const toggleSubmissionSelection = (submissionId) => {
    if (selectedSubmissions.includes(submissionId)) {
      setSelectedSubmissions(prevSelected => prevSelected.filter(id => id !== submissionId));
    } else {
      setSelectedSubmissions(prevSelected => [...prevSelected, submissionId]);
    }
  };

  // Check web similarity for selected submissions
  const checkWebSimilarity = async () => {
    if (selectedSubmissions.length === 0) {
      showNotification('Please select at least one submission to check', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Check each selected submission
      const webCheckPromises = selectedSubmissions.map(async (submissionId) => {
        const response = await axios.post(`${baseUrl}/web-similarity/`, {
          submission_id: submissionId
        });
        
        return response.data;
      });
      
      const results = await Promise.all(webCheckPromises);
      setWebResults(results);
      setActiveTab("webResults");
      
      // Refresh submissions to get updated similarity scores
      fetchSubmissions();
      
      showNotification('Web similarity check completed successfully', 'success');
    } catch (error) {
      console.error('Error in web similarity check:', error);
      setError(`Web similarity check failed: ${error.response?.data?.message || error.message}`);
      showNotification(`Web similarity check failed: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Check assignment-to-assignment similarity
  const checkAssignmentSimilarity = async () => {
    // If we're in the submissions tab, use selectedSubmissions instead
    if (activeTab === 'submissions' && selectedSubmissions.length >= 2) {
      try {
        setLoading(true);
        setError(null);
        
        console.log("Comparing submissions:", selectedSubmissions);
        
        // Send comparison request to backend using the selected submissions
        const response = await axios.post(`${baseUrl}/compare/`, {
          assignment_ids: selectedSubmissions 
        });
        
        console.log("Comparison response:", response.data);
        
        if (response.data.status === 'success') {
          // Format the similarity data for display
          const formattedResults = response.data.results.map(result => {
            // Add reference to submission names for better display
            const submission1 = submissions.find(s => s.submission_id === result.assignment1_id);
            const submission2 = submissions.find(s => s.submission_id === result.assignment2_id);
            
            if (submission1 && submission2) {
              result.assignment1_title = submission1.student_name || result.assignment1_title;
              result.assignment2_title = submission2.student_name || result.assignment2_title;
            }
            
            return result;
          });
          
          setAssignmentResults(formattedResults);
          setActiveTab("assignmentResults");
          showNotification('Submissions compared successfully', 'success');
        } else {
          setError(response.data.message || "Failed to compare submissions");
          showNotification(response.data.message || "Failed to compare submissions", 'error');
        }
      } catch (error) {
        console.error('Error comparing submissions:', error);
        setError(`Comparison failed: ${error.response?.data?.message || error.message}`);
        showNotification(`Comparison failed: ${error.response?.data?.message || error.message}`, 'error');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Original assignment comparison logic
    const selectedAssignments = existingAssignments.filter(a => a.selected);
    const totalAssignments = files.length + selectedAssignments.length;
    
    if (totalAssignments < 2) {
      setError("Please select at least two files or assignments to compare");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let assignmentIds = [];
      
      // If new files are uploaded, add them first
      if (files.length > 0) {
        const uploadResults = await uploadFiles();
        if (uploadResults.length === 0 && selectedAssignments.length < 2) {
          setLoading(false);
          return;
        }
        
        assignmentIds = uploadResults.map(result => result.assignment_id);
      }
      
      // Add selected existing assignments
      assignmentIds = [
        ...assignmentIds,
        ...selectedAssignments.map(assignment => assignment.id)
      ];
      
      if (assignmentIds.length < 2) {
        setError("Please select at least two assignments to compare");
        setLoading(false);
        return;
      }
      
      // Send comparison request to backend
      const response = await axios.post(`${baseUrl}/compare/`, {
        assignment_ids: assignmentIds
      });
      
      if (response.data.status === 'success') {
        setAssignmentResults(response.data.results);
        setActiveTab("assignmentResults");
        showNotification('Assignments compared successfully', 'success');
      } else {
        setError(response.data.message);
        showNotification(response.data.message, 'error');
      }
    } catch (error) {
      setError(`Assignment similarity check failed: ${error.response?.data?.message || error.message}`);
      showNotification(`Assignment similarity check failed: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show notification message
  const showNotification = (message, type) => {
    setNotification({ message, type });
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Clear notification
  const clearNotification = () => {
    setNotification(null);
  };

  // Handle file download
  const handleDownloadFile = async (filePath, fileName) => {
    try {
      // Construct the URL based on the file path
      const fileUrl = `${baseUrl}/media/${filePath}`;
      
      // Fetch the file blob
      const response = await axios.get(fileUrl, {
        responseType: 'blob'
      });
  
      // Create a blob URL and trigger download
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName || 'download');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
      showNotification('File downloaded successfully', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('Failed to download the file', 'error');
    }
  };

  // View file
  const viewFile = async (filePath) => {
    try {
      // Try to use the direct file URL
      const fileUrl = `${baseUrl}/media/${filePath}`;
      window.open(fileUrl, '_blank');
    } catch (error) {
      console.error('View failed:', error);
      showNotification('Failed to view the file', 'error');
    }
  };

  // View report in new tab
  const viewReport = (reportUrl) => {
    window.open(`http://127.0.0.1:8000${reportUrl}`, '_blank');
  };

  // Download report
  const downloadReport = (downloadUrl) => {
    window.open(`http://127.0.0.1:8000${downloadUrl}`, '_blank');
  };

  // View detailed comparison report
  const viewDetailedComparisonReport = (result) => {
    setSelectedReport(result);
    setShowDetailedReport(true);
  };

  // Close detailed report view
  const closeDetailedReport = () => {
    setShowDetailedReport(false);
    setSelectedReport(null);
  };

  // Get color based on similarity percentage
  const getSimilarityColor = (percentage) => {
    if (percentage === null || percentage === undefined) return "secondary";
    if (percentage < 30) return "success"; // Low similarity
    if (percentage < 60) return "warning"; // Medium similarity
    return "danger"; // High similarity
  };

  // Filter results based on similarity threshold
  const filterResults = (results) => {
    if (!results) return [];
    return results.filter((result) => {
      const similarityScore = 
        result.web_similarity_score || 
        result.similarity_score || 
        result.similarity || 0;
      return similarityScore >= threshold;
    });
  };

  // Delete a submission
  const deleteSubmission = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`${baseUrl}/delete-submission/${submissionId}/`);
      
      // Remove from selected submissions
      setSelectedSubmissions(prev => prev.filter(id => id !== submissionId));
      
      // Refresh the submissions list
      fetchSubmissions();
      
      showNotification('Submission deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting submission:', error);
      showNotification(`Failed to delete submission: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Notification component
  const Notification = ({ message, type, onClose }) => {
    const getIcon = () => {
      switch (type) {
        case 'success':
          return <FaCheckCircle className="text-white mr-2" />;
        case 'error':
          return <FaExclamationCircle className="text-white mr-2" />;
        default:
          return <FaInfoCircle className="text-white mr-2" />;
      }
    };

    const getBgColor = () => {
      switch (type) {
        case 'success':
          return 'bg-success';
        case 'error':
          return 'bg-danger';
        default:
          return 'bg-primary';
      }
    };

    return (
      <div className={`position-fixed top-0 end-0 p-3`} style={{ zIndex: 1050 }}>
        <div className={`toast show ${getBgColor()} text-white`} role="alert" aria-live="assertive" aria-atomic="true">
          <div className="toast-header">
            {getIcon()}
            <strong className="me-auto">{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</strong>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="toast-body">
            {message}
          </div>
        </div>
      </div>
    );
  };

  // If showing detailed report, render the AssignmentSimilarityReport component
  if (showDetailedReport) {
    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 p-0">
            <div className="bg-light p-2 d-flex justify-content-between align-items-center shadow-sm">
              <button 
                className="btn btn-outline-secondary" 
                onClick={closeDetailedReport}
              >
                <FaArrowLeft className="me-2" />
                Back to Results
              </button>
            </div>
          </div>
        </div>
        <AssignmentSimilarityReport 
          assignmentResults={selectedReport} 
        />
      </div>
    );
  }

  if (loading && !assignmentDetails && !submissions.length) {
    return (
      <div className="container py-4">
        <div className="row g-4">
          <aside className="col-md-3">
            <LecturerSidebar />
          </aside>
          <section className="col-md-9">
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-3">
                <h5 className="m-0">Assignment Submissions</h5>
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span className="ms-3">Loading submissions...</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Notification Component */}
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={clearNotification} 
        />
      )}

      <div className="row g-4">
        <aside className="col-md-3">
          <LecturerSidebar />
        </aside>
        <section className="col-md-9">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-3">
              <h5 className="m-0">
                {assignmentDetails 
                  ? `Submissions for: ${assignmentDetails.title}` 
                  : "Assignment Submissions"}
              </h5>
              <Link 
                to={`/detail/${assignmentDetails?.course_id}`}
                className="btn btn-sm btn-outline-light"
              >
                <FaArrowLeft className="me-2" />
                Back to Course
              </Link>
            </div>
            <div className="card-body">
              {/* Navigation Tabs */}
              <ul className="nav nav-tabs mb-4">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'submissions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('submissions')}
                  >
                    Submissions
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'compareAssignments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('compareAssignments')}
                  >
                    Compare Assignments
                  </button>
                </li>
                {webResults && webResults.length > 0 && (
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${activeTab === 'webResults' ? 'active' : ''}`}
                      onClick={() => setActiveTab('webResults')}
                    >
                      Web Similarity
                    </button>
                  </li>
                )}
                {assignmentResults && assignmentResults.length > 0 && (
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${activeTab === 'assignmentResults' ? 'active' : ''}`}
                      onClick={() => setActiveTab('assignmentResults')}
                    >
                      Assignment Comparison
                    </button>
                  </li>
                )}
              </ul>

              {/* Submissions Tab Content */}
              {activeTab === 'submissions' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Student Submissions</h5>
                    <div>
                      <button 
                        className="btn btn-success me-2"
                        onClick={checkWebSimilarity}
                        disabled={loading || selectedSubmissions.length === 0}
                      >
                        <FaGlobe className="me-2" />
                        Check Web Similarity
                      </button>
                      <button
                        className="btn btn-info text-white"
                        onClick={checkAssignmentSimilarity}
                        disabled={loading || selectedSubmissions.length < 2}
                      >
                        <FaExchangeAlt className="me-2" />
                        Compare Submissions
                      </button>
                    </div>
                  </div>

                  {/* Display submissions */}
                  {submissions.length > 0 ? (
                    <div className="list-group mb-4">
                      {submissions.map((submission) => (
                        <div
                          key={submission.submission_id}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                            selectedSubmissions.includes(submission.submission_id) ? "active" : ""
                          }`}
                          onClick={() => toggleSubmissionSelection(submission.submission_id)}
                        >
                          <div className="d-flex flex-column">
                            <div className="d-flex align-items-center">
                              <i className="bi bi-file-earmark-text me-2"></i>
                              <strong>{submission.student_name || `Student ID: ${submission.student}`}</strong>
                              {submission.submitted_at && (
                                <span className="badge bg-secondary ms-2">
                                  {submission.submitted_at}
                                </span>
                              )}
                            </div>
                            <small className="text-muted">{submission.file_name || "Submission file"}</small>
                          </div>
                          <div className="d-flex align-items-center">
                            {submission.similarity_score !== null && (
                              <span 
                                className={`badge bg-${getSimilarityColor(submission.similarity_score)} me-3`}
                              >
                                {submission.similarity_score}% Similar
                              </span>
                            )}
                            <div className="btn-group me-2">
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewFile(submission.file_path);
                                }}
                                title="View Submission"
                              >
                                <FaEye />
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(submission.file_path, submission.file_name);
                                }}
                                title="Download Submission"
                              >
                                <FaDownload />
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSubmission(submission.submission_id);
                                }}
                                title="Delete Submission"
                              >
                                <FaTrash />
                              </button>
                            </div>
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedSubmissions.includes(submission.submission_id)}
                                onChange={() => {}}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      No submissions have been received for this assignment yet.
                    </div>
                  )}
                </div>
              )}
              
              {/* Compare Assignments Tab Content */}
              {activeTab === 'compareAssignments' && (
                <div>
                  <h5 className="mb-3">Compare Assignments</h5>
                  
                  {/* File Upload Section */}
                  <div className="mb-4">
                    <div className="upload-area p-4 border border-dashed rounded mb-3 bg-light text-center">
                      <input
                        type="file"
                        multiple
                        className="d-none"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <FaUpload className="fs-1 text-primary mb-2" />
                      <p>Drag and drop files here or</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse Files
                      </button>
                      <p className="mt-2 text-muted small">Supported formats: PDF, DOC, DOCX, TXT</p>
                    </div>

                    {/* Selected Files List */}
                    {files.length > 0 && (
                      <div className="selected-files mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Selected Files ({files.length})</h6>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={clearFiles}
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="list-group">
                          {files.map((file, index) => (
                            <div
                              key={index}
                              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                            >
                              <div>
                                <FaFile className="me-2" />
                                {file.name}
                                <span className="badge bg-secondary ms-2">
                                  {(file.size / 1024).toFixed(2)} KB
                                </span>
                              </div>
                              <button
                                className="btn btn-sm btn-close"
                                onClick={() => removeFile(index)}
                              ></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Existing Assignments */}
                    {existingAssignments.length > 0 && (
                      <div className="existing-files mb-3">
                        <h6 className="mb-2">Existing Assignments</h6>
                        <p className="text-muted mb-2 small">Select assignments to check</p>
                        <div className="list-group">
                          {existingAssignments.map((assignment) => (
                            <div
                              key={assignment.id}
                              className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                                assignment.selected ? "active" : ""
                              }`}
                              onClick={() => toggleAssignmentSelection(assignment.id)}
                            >
                              <div>
                                <FaFile className="me-2" />
                                {assignment.title}
                                {assignment.uploaded_at && (
                                  <span className="badge bg-secondary ms-2">
                                    {new Date(assignment.uploaded_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={assignment.selected || false}
                                  onChange={() => {}}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={checkAssignmentSimilarity}
                      disabled={loading || (files.length + existingAssignments.filter(a => a.selected).length < 2)}
                    >
                      <FaExchangeAlt className="me-2" />
                      Compare Assignments
                    </button>
                  </div>
                </div>
              )}

              {/* Web Similarity Results Tab Content */}
              {activeTab === 'webResults' && webResults && (
                <div>
                  <h5 className="mb-3">Web Similarity Results</h5>
                  <div className="mb-3">
                    <label htmlFor="threshold" className="form-label">
                      Show results above:
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range me-2"
                        min="0"
                        max="100"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        style={{ width: "200px" }}
                      />
                      <span className="badge bg-secondary">{threshold}%</span>
                    </div>
                  </div>
                  
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Student</th>
                          <th>Submission</th>
                          <th className="text-center">Similarity %</th>
                          <th>Analysis</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResults(webResults).map((result, index) => (
                          <tr key={index}>
                            <td>{result.student_name || 'Unknown'}</td>
                            <td>{result.assignment_title || `Submission ${result.submission_id}`}</td>
                            <td className="text-center">
                              <div className={`badge bg-${getSimilarityColor(result.web_similarity_score)} p-2 fs-6`}>
                                {result.web_similarity_score}%
                              </div>
                            </td>
                            <td>{result.analysis_summary || 'No analysis available'}</td>
                            <td>
                              {result.report_url ? (
                                <div className="btn-group">
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => viewReport(result.report_url)}
                                    title="View Original Report"
                                  >
                                    <FaEye className="me-1" /> View
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => downloadReport(result.download_url)}
                                    title="Download Original Report"
                                  >
                                    <FaDownload className="me-1" /> Download
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => viewDetailedComparisonReport({
                                      assignment: [{
                                        id: index,
                                        file1: result.student_name || 'Submission',
                                        file2: 'Web Content',
                                        similarity: result.web_similarity_score,
                                        text1: [{ text: result.analysis_summary || 'No text available', isMatch: false }],
                                        text2: [{ text: 'Web content analysis', isMatch: false }],
                                        report_url: result.report_url
                                      }]
                                    })}
                                    title="View Interactive Report"
                                  >
                                    <FaFilePdf className="me-1" /> Report
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted">No report available</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {filterResults(webResults).length === 0 && (
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      No results match the current threshold. Try lowering the threshold.
                    </div>
                  )}
                </div>
              )}

              {/* Assignment Comparison Results Tab Content */}
              {activeTab === 'assignmentResults' && assignmentResults && (
                <div>
                  <h5 className="mb-3">Assignment Comparison Results</h5>
                  <div className="mb-3">
                    <label htmlFor="threshold" className="form-label">
                      Show results above:
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range me-2"
                        min="0"
                        max="100"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        style={{ width: "200px" }}
                      />
                      <span className="badge bg-secondary">{threshold}%</span>
                    </div>
                  </div>
                  
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Assignment 1</th>
                          <th>Assignment 2</th>
                          <th className="text-center">Similarity %</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResults(assignmentResults).map((result, index) => (
                          <tr key={index}>
                            <td>{result.assignment1_title || 'Unknown'}</td>
                            <td>{result.assignment2_title || 'Unknown'}</td>
                            <td className="text-center">
                              <div className={`badge bg-${getSimilarityColor(result.similarity_score)} p-2 fs-6`}>
                                {result.similarity_score}%
                              </div>
                            </td>
                            <td>
                              <div className="btn-group">
                                {result.report_url && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => viewReport(result.report_url)}
                                      title="View Original Report"
                                    >
                                      <FaEye className="me-1" /> View
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-success"
                                      onClick={() => downloadReport(result.download_url)}
                                      title="Download Original Report"
                                    >
                                      <FaDownload className="me-1" /> Download
                                    </button>
                                  </>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-info"
                                  onClick={() => viewDetailedComparisonReport({
                                    assignment: [{
                                      id: index,
                                      file1: result.assignment1_title || 'Assignment 1',
                                      file2: result.assignment2_title || 'Assignment 2',
                                      similarity: result.similarity_score,
                                      text1: result.text1 || [{ text: 'No text available', isMatch: false }],
                                      text2: result.text2 || [{ text: 'No text available', isMatch: false }],
                                      report_url: result.report_url
                                    }]
                                  })}
                                  title="View Interactive Report"
                                >
                                  <FaFilePdf className="me-1" /> Report
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {filterResults(assignmentResults).length === 0 && (
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      No comparison results match the current threshold. Try lowering the threshold.
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="alert alert-danger mt-3">
                  <FaExclamationCircle className="me-2" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SimilarityChecker;