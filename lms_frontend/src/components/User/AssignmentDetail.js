import React, { useState, useEffect } from "react";
import {
  Typography,
  Button,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { Upload, X, Check, AlertCircle, Download } from "lucide-react";
import axios from "axios";

function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null); // Added userId state
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingWebSimilarity, setCheckingWebSimilarity] = useState(false);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [reportUrl, setReportUrl] = useState(null);
  const [reportFilename, setReportFilename] = useState(null);

  // Load user information when component mounts
  useEffect(() => {
    // Get user information from localStorage
    const storedUserId = localStorage.getItem("studentId");
    const storedUserName = localStorage.getItem("student_name") || localStorage.getItem("username");
    
    if (storedUserId) {
      setUserId(storedUserId);
      
      // Pre-fill name if available from localStorage
      if (storedUserName) {
        setName(storedUserName);
      }
    }
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError("");
  };

  const handleClearFile = () => {
    setFile(null);
  };

  const handleCheckWebSimilarity = async () => {
    if (!submitted) {
      setError("Please submit your assignment first before checking web similarity.");
      return;
    }
    
    if (!submissionData || !submissionData.submission_id) {
      setError("Submission data is incomplete. Please try submitting again.");
      return;
    }
  
    // If we already have a similarity score and report, just show that instead of making a new API call
    if (similarityScore !== null && reportUrl) {
      setSnackbarOpen(true);
      return;
    }
  
    try {
      setCheckingWebSimilarity(true);
      setError("");
      
      const response = await axios.post("http://127.0.0.1:8000/api/web-similarity/", {
        submission_id: submissionData.submission_id
      });
      
      if (response.data.status === "success") {
        // Try to extract the similarity score from the response data
        let score = null;
        
        // Check all possible locations for the score
        if (response.data.web_similarity_score !== undefined) {
          score = response.data.web_similarity_score;
        } else if (response.data.similarity_score !== undefined) {
          score = response.data.similarity_score;
        } else if (response.data.analysis_summary) {
          // Try to extract the score from the analysis_summary text
          const pattern = /Calculated similarity: (\d+\.\d+)%/;
          const match = response.data.analysis_summary.match(pattern);
          if (match && match[1]) {
            score = parseFloat(match[1]);
          }
        }
        
        // If score was found, use it - but ONLY if we don't already have a score OR if the new score is valid
        if (score !== null) {
          // Make sure score is a valid number to prevent weird values
          if (!isNaN(score)) {
            setSimilarityScore(score);
            
            // Show success message
            setSnackbarOpen(true);
            
            // Update localStorage with the actual similarity score and report URL
            if (submissionData) {
              const updatedData = {
                ...submissionData, 
                web_similarity_score: score,
                report_url: response.data.report_url || null,
                report_filename: response.data.report_url ? 
                  response.data.report_url.split('/').pop() : null
              };
              
              // Store the updated data with a consistent format
              localStorage.setItem(`assignment_${id}_data`, JSON.stringify(updatedData));
              setSubmissionData(updatedData);
            }
          }
        } else {
          setError("Could not determine similarity score from the response");
        }
        
        // Store the report URL and filename for download option
        if (response.data.report_url) {
          const fullReportUrl = `http://127.0.0.1:8000${response.data.report_url}`;
          setReportUrl(fullReportUrl);
          
          // Extract filename from the URL
          const urlParts = response.data.report_url.split('/');
          const filename = urlParts[urlParts.length - 1];
          setReportFilename(filename);
        }
      } else {
        setError(response.data.message || "An error occurred during web similarity check.");
      }
    } catch (err) {
      console.error("Error checking web similarity:", err);
      setError(
        err.response?.data?.message || 
        "Failed to check web similarity. Please try again."
      );
    } finally {
      setCheckingWebSimilarity(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (!file) {
      setError("Please upload a file before submitting.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append("name", name);
      formData.append("file", file);
      formData.append("assignment_id", id); // Use assignment ID from URL params
      
      // Add student_id to the form data if available
      if (userId) {
        formData.append("student_id", userId);
        console.log("Including student ID in submission:", userId);
      }

      // Make the API call to the backend
      const response = await axios.post(`http://127.0.0.1:8000/api/submit-assignment/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Handle successful response
      if (response.data.status === "success") {
        // Save submission status and data to localStorage
        localStorage.setItem(`assignment_${id}_status`, "submitted");
        
        if (response.data.data) {
          localStorage.setItem(`assignment_${id}_data`, JSON.stringify(response.data.data));
          setSubmissionData(response.data.data);
          
          // Don't set any default similarity score, wait for web similarity check
          setSimilarityScore(null);
        }
        
        setSubmitted(true);
        setSnackbarOpen(true);
      } else {
        // Handle error in response
        setError(response.data.message || "An error occurred during submission.");
      }
    } catch (err) {
      console.error("Error submitting assignment:", err);
      setError(
        err.response?.data?.message || 
        "An error occurred while submitting your assignment. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setOpenDialog(false);
    
    if (submissionData && submissionData.submission_id) {
      try {
        setLoading(true);
        setError("");
        
        // Call the backend API to delete the submission
        const response = await axios.delete(`http://127.0.0.1:8000/api/delete-submission/${submissionData.submission_id}/`);
        
        if (response.data.status === "success") {
          // Also try to delete the report if one exists
          if (reportFilename) {
            try {
              await axios.delete(`http://127.0.0.1:8000/api/delete-web-report/${reportFilename}`);
            } catch (reportErr) {
              console.error("Error deleting report:", reportErr);
              // Continue with local cleanup even if report deletion fails
            }
          }
          
          // Clear all local state
          localStorage.removeItem(`assignment_${id}_status`);
          localStorage.removeItem(`assignment_${id}_data`);
          setSubmitted(false);
          setSubmissionData(null);
          setSimilarityScore(null);
          setReportUrl(null);
          setReportFilename(null);
          setFile(null);
          setName("");
          setSnackbarOpen(true);
        } else {
          setError(response.data.message || "Failed to remove submission. Please try again.");
        }
      } catch (err) {
        console.error("Error removing submission:", err);
        setError(
          err.response?.data?.message || 
          "An error occurred while removing your submission. Please try again."
        );
        // Still cleanup local state even if server request fails
        localStorage.removeItem(`assignment_${id}_status`);
        localStorage.removeItem(`assignment_${id}_data`);
        setSubmitted(false);
        setSubmissionData(null);
        setSimilarityScore(null);
        setReportUrl(null);
        setReportFilename(null);
        setFile(null);
        setName("");
      } finally {
        setLoading(false);
      }
    } else {
      // No submission data found, just clear local state
      localStorage.removeItem(`assignment_${id}_status`);
      localStorage.removeItem(`assignment_${id}_data`);
      setSubmitted(false);
      setSubmissionData(null);
      setSimilarityScore(null);
      setReportUrl(null);
      setReportFilename(null);
      setFile(null);
      setName("");
    }
  };
  
  const handleViewReport = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank');
    } else {
      setError("No report is available to view.");
    }
  };
  
  const handleDownloadReport = async () => {
    if (!reportFilename) {
      setError("No report is available to download.");
      return;
    }
    
    try {
      // Direct AJAX request to get the file with proper headers
      setError("");
      const downloadUrl = `http://127.0.0.1:8000/api/download-web-report/${reportFilename}`;
      
      // Using axios for the download to handle response properly
      const response = await axios.get(downloadUrl, {
        responseType: 'blob', // Important: we want a binary response
      });
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `similarity-report-assignment-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      setSnackbarOpen(true);
    } catch (err) {
      console.error("Error downloading report:", err);
      setError(
        err.response?.data?.message || 
        "Failed to download the report. Please try again."
      );
    }
  };

  // Determine color based on similarity score
  const getSimilarityColor = (score) => {
    if (score >= 70) return "#D32F2F"; // Red for high similarity
    if (score >= 40) return "#FFEB3B"; // Yellow for moderate similarity
    return "#388E3C"; // Green for low similarity
  };

  useEffect(() => {
    // Check if there's a saved submission status in localStorage
    const isSubmitted = localStorage.getItem(`assignment_${id}_status`);
    if (isSubmitted === "submitted") {
      setSubmitted(true);
      // Try to get saved submission data
      const savedData = localStorage.getItem(`assignment_${id}_data`);
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          setSubmissionData(data);
          
          // Check for similarity score in saved data - validate it's a proper number
          if (data.web_similarity_score !== undefined && !isNaN(data.web_similarity_score)) {
            // Lock in the similarity score
            const storedScore = parseFloat(data.web_similarity_score);
            console.log("Loading stored similarity score:", storedScore);
            setSimilarityScore(storedScore);
          }
          
          // Check for report URL and filename in saved data
          if (data.report_url) {
            setReportUrl(`http://127.0.0.1:8000${data.report_url}`);
          }
          if (data.report_filename) {
            setReportFilename(data.report_filename);
          }
        } catch (e) {
          console.error("Error parsing saved data:", e);
        }
      }
    }
  }, [id]); // Only re-run if the assignment ID changes

  return (
    <Box
      sx={{
        maxWidth: 650,
        mx: "auto",
        mt: 4,
        p: 4,
        bgcolor: "background.paper",
        boxShadow: 3,
        borderRadius: 2,
        minHeight: "500px",
        mb: 6,
      }}
    >
      <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold", textAlign: "center" }}>
        Submit Assignment {id}
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, textAlign: "center", color: "text.secondary" }}>
        Upload your assignment file and check for web similarity.
      </Typography>

      {submitted ? (
        <>
          <Alert severity="success" sx={{ mb: 3, fontWeight: "bold" }}>
            <Check size={20} style={{ marginRight: "8px" }} />
            Assignment {id} has been successfully submitted!
          </Alert>

          {similarityScore !== null && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mt: 3,
                mb: 3,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: "bold", mr: 1 }}>
                Web Similarity Score:
              </Typography>
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: "50px",
                  fontWeight: "bold",
                  color: "white",
                  bgcolor: getSimilarityColor(similarityScore),
                  display: "inline-block",
                  minWidth: "60px",
                  textAlign: "center",
                }}
              >
                {similarityScore}%
              </Box>
            </Box>
          )}

          {/* Display submission details if available */}
          {submissionData && (
            <Box sx={{ mt: 3, mb: 3, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                Submission Details:
              </Typography>
              <Typography variant="body2">
                <strong>Name:</strong> {submissionData.student_name}
              </Typography>
              <Typography variant="body2">
                <strong>File:</strong> {submissionData.file_name}
              </Typography>
              {submissionData.submitted_at && (
                <Typography variant="body2">
                  <strong>Submitted at:</strong> {submissionData.submitted_at}
                </Typography>
              )}
            </Box>
          )}

          <Button
            variant="contained"
            color="warning"
            fullWidth
            sx={{ mb: 2 }}
            onClick={handleCheckWebSimilarity}
            disabled={checkingWebSimilarity}
          >
            {checkingWebSimilarity ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Check Web Similarity"
            )}
          </Button>
          
          {/* Report action buttons */}
          {(reportUrl || reportFilename) && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                color="info"
                sx={{ flex: 1 }}
                onClick={handleViewReport}
              >
                View Report
              </Button>
              
              <Button
                variant="contained"
                color="success"
                sx={{ flex: 1 }}
                onClick={handleDownloadReport}
                startIcon={<Download size={18} />}
              >
                Download Report
              </Button>
            </Box>
          )}

          <Button
            variant="outlined"
            color="primary"
            sx={{ mt: 1 }}
            fullWidth
            onClick={() => setOpenDialog(true)}
          >
            Remove Submission & Upload New File
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, fontWeight: "bold" }}>
              <AlertCircle size={20} style={{ marginRight: "8px" }} />
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Your Name"
            variant="outlined"
            sx={{ mb: 2 }}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<Upload size={16} />}
            >
              Upload File
              <input 
                type="file" 
                hidden 
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt" 
              />
            </Button>
            {file && (
              <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                  Selected file: {file.name}
                </Typography>
                <IconButton onClick={handleClearFile} size="small">
                  <X size={16} />
                </IconButton>
              </Box>
            )}
          </Box>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading || !name || !file}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Submit Assignment"}
          </Button>
        </form>
      )}

      <Button
        variant="outlined"
        color="secondary"
        fullWidth
        sx={{ mt: 3 }}
        onClick={() => navigate("/user-assignments")}
      >
        Back to Assignments
      </Button>

      {/* Confirmation Dialog for Remove Submission */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Remove Submission</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove your submission and upload a new file? This will delete the submission from our servers.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="secondary">
            Cancel
          </Button>
          <Button 
            onClick={handleRemove} 
            color="error"
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Yes, Remove"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={
          similarityScore !== null && snackbarOpen ? 
            "Web similarity check complete!" : 
          !submitted && snackbarOpen ?
            "Submission removed successfully!" :
          reportFilename && snackbarOpen ? 
            "Report downloaded successfully!" : 
            "Assignment submitted successfully!"
        }
      />
    </Box>
  );
}

export default AssignmentDetail;