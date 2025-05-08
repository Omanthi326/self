import React, { useRef, useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";
import { FaDownload, FaEye, FaFilePdf, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

function AssignmentSimilarityReport({ assignmentResults = null, reportUrl = null }) {
  const reportRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedText, setExpandedText] = useState(false);
  const [similarTexts, setSimilarTexts] = useState({ text1: [], text2: [] });
  
  const baseUrl = "http://127.0.0.1:8000/api";

  // Fetch report data if reportUrl is provided but not assignmentResults
  useEffect(() => {
    if (reportUrl && !assignmentResults) {
      fetchReportData();
    } else if (assignmentResults) {
      // Use provided assignment results
      setReportData(assignmentResults);
      
      // Extract submission IDs or report URL
      if (assignmentResults.assignment && assignmentResults.assignment.length > 0) {
        const item = assignmentResults.assignment[0];
        
        // If we have report_url, extract content from the PDF report
        if (item.report_url) {
          fetchPdfReportContent(item.report_url);
        } 
        // Otherwise try to get content through submission IDs
        else if (item.assignment1_id && item.assignment2_id) {
          fetchSubmissionContents(item.assignment1_id, item.assignment2_id);
        } else {
          // Create placeholder if nothing else is available
          createPlaceholderSegments(assignmentResults);
        }
      }
    }
  }, [reportUrl, assignmentResults]);

  // Fetch content directly from the PDF report
  const fetchPdfReportContent = async (reportUrl) => {
    setLoading(true);
    
    try {
      // First try to fetch the report content through a special endpoint
      const response = await axios.post(`${baseUrl}/extract-report-content/`, {
        report_url: reportUrl
      });
      
      if (response.data && response.data.status === 'success') {
        // Set the similar text segments from the PDF report
        setSimilarTexts({
          text1: response.data.text1_segments || [],
          text2: response.data.text2_segments || []
        });
      } else {
        // Fall back to other methods if PDF extraction fails
        fallbackToDefaultMethods(reportUrl);
      }
    } catch (error) {
      console.error("Error extracting content from PDF report:", error);
      // Fall back to other methods
      fallbackToDefaultMethods(reportUrl);
    } finally {
      setLoading(false);
    }
  };
  
  // Fall back to other methods if PDF extraction fails
  const fallbackToDefaultMethods = (reportUrl) => {
    // If we have assignment IDs, try to get content through them
    if (reportData?.assignment?.[0]?.assignment1_id && reportData?.assignment?.[0]?.assignment2_id) {
      const item = reportData.assignment[0];
      fetchSubmissionContents(item.assignment1_id, item.assignment2_id);
    } else if (assignmentResults?.assignment?.[0]?.assignment1_id && assignmentResults?.assignment?.[0]?.assignment2_id) {
      const item = assignmentResults.assignment[0];
      fetchSubmissionContents(item.assignment1_id, item.assignment2_id);
    } else {
      // Create placeholder if nothing else works
      createPlaceholderSegments(reportData || assignmentResults);
    }
  };

  // Function to fetch report data
  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract report ID from URL if needed
      let reportId = reportUrl;
      if (reportUrl && reportUrl.includes("/")) {
        reportId = reportUrl.split("/").pop();
      }
      
      // Fetch report data from server
      const response = await axios.get(`${baseUrl}/reports/${reportId}`);
      
      if (response.data) {
        setReportData(response.data);
        
        // Try to extract content from the PDF report if a URL is available
        if (response.data.report_url) {
          fetchPdfReportContent(response.data.report_url);
        }
        // Otherwise try to use submission IDs
        else if (response.data.assignment && response.data.assignment.length > 0) {
          const item = response.data.assignment[0];
          if (item.assignment1_id && item.assignment2_id) {
            fetchSubmissionContents(item.assignment1_id, item.assignment2_id);
          } else {
            createPlaceholderSegments(response.data);
          }
        }
      } else {
        setError("Could not load report data");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      setError(`Failed to load report: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch submission contents
  const fetchSubmissionContents = async (id1, id2) => {
    setLoading(true);
    
    try {
      // First, try to get the comparison data
      const comparisonResponse = await axios.post(`${baseUrl}/detailed-comparison/`, {
        submission_id1: id1,
        submission_id2: id2
      });
      
      if (comparisonResponse.data && comparisonResponse.data.status === 'success') {
        // Use the comparison data if available
        setSimilarTexts({
          text1: comparisonResponse.data.text1 || [],
          text2: comparisonResponse.data.text2 || []
        });
      } else {
        // If comparison data is not available, fetch individual contents
        const [content1, content2] = await Promise.all([
          fetchSubmissionContent(id1),
          fetchSubmissionContent(id2)
        ]);
        
        // Get similarity percentage
        const similarity = reportData?.assignment?.[0]?.similarity || 
                          (assignmentResults?.assignment?.[0]?.similarity) || 100;
        
        // Create segments with the content
        if (content1 && content2) {
          // Process the content to find similar sections
          processAndHighlightContent(content1, content2, similarity);
        } else {
          // Create placeholder segments if content fetch fails
          createPlaceholderSegments(reportData || assignmentResults);
        }
      }
    } catch (error) {
      console.error("Error fetching submission contents:", error);
      // Create placeholder segments if fetch fails
      createPlaceholderSegments(reportData || assignmentResults);
    } finally {
      setLoading(false);
    }
  };
  
  // Process and highlight similar content between two texts
  const processAndHighlightContent = (text1, text2, similarityScore) => {
    try {
      // Split text into sentences or paragraphs
      const segments1 = text1.split(/(?<=[.!?])\s+/);
      const segments2 = text2.split(/(?<=[.!?])\s+/);
      
      // Find similar segments using basic string matching
      // This is a simplified algorithm - your backend's algorithm is likely more sophisticated
      const similarSegments = [];
      
      segments1.forEach((seg1, i) => {
        segments2.forEach((seg2, j) => {
          // Simple similarity check (can be improved)
          const similarity = calculateStringSimilarity(seg1, seg2);
          if (similarity > 0.7) { // Threshold for similarity
            similarSegments.push({
              text1: seg1,
              text2: seg2,
              text1Index: i,
              text2Index: j,
              similarity: Math.round(similarity * 100)
            });
          }
        });
      });
      
      // Create highlighted segments
      const text1Segments = [];
      const text2Segments = [];
      
      // Mark matching segments
      if (similarSegments.length > 0) {
        // Sort by position in text1
        const sortedSegments = [...similarSegments].sort((a, b) => a.text1Index - b.text1Index);
        
        sortedSegments.forEach(match => {
          text1Segments.push({
            text: match.text1,
            isMatch: true,
            percentage: match.similarity
          });
        });
        
        // Sort by position in text2
        const sortedSegments2 = [...similarSegments].sort((a, b) => a.text2Index - b.text2Index);
        
        sortedSegments2.forEach(match => {
          text2Segments.push({
            text: match.text2,
            isMatch: true,
            percentage: match.similarity
          });
        });
      }
      
      // If no segments found but similarity score is high, use full text
      if (text1Segments.length === 0 && text2Segments.length === 0 && similarityScore > 0) {
        text1Segments.push({
          text: text1,
          isMatch: true,
          percentage: similarityScore
        });
        
        text2Segments.push({
          text: text2,
          isMatch: true,
          percentage: similarityScore
        });
      }
      
      setSimilarTexts({
        text1: text1Segments,
        text2: text2Segments
      });
    } catch (error) {
      console.error("Error processing content:", error);
      createPlaceholderSegments(reportData || assignmentResults);
    }
  };

  // Calculate string similarity (simplified Levenshtein distance ratio)
  const calculateStringSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    // Simplified similarity calculation for demo purposes
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    // Count matching characters
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) {
        matches++;
      }
    }
    
    return matches / longer.length;
  };

  // Function to fetch a single submission's content
  const fetchSubmissionContent = async (submissionId) => {
    try {
      const response = await axios.post(`${baseUrl}/submission-content/`, {
        submission_id: submissionId
      });
      
      if (response.data && response.data.status === 'success') {
        return response.data.content;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching content for submission ${submissionId}:`, error);
      return null;
    }
  };

  // Create placeholder text segments when actual content is unavailable
  const createPlaceholderSegments = (data) => {
    if (!data || !data.assignment || !data.assignment.length) return;
    
    const similarity = data.assignment[0].similarity || 0;
    
    if (similarity === 0) {
      setSimilarTexts({
        text1: [{ text: "No similarity detected between documents.", isMatch: false }],
        text2: [{ text: "No similarity detected between documents.", isMatch: false }]
      });
      return;
    }
    
    // For similarity > 0, create appropriate placeholders
    setSimilarTexts({
      text1: [
        { 
          text: `This document contains approximately ${similarity}% similar content with the other document. `, 
          isMatch: true, 
          percentage: similarity 
        },
        { 
          text: "The system has detected matching content between these documents. For the most detailed view of exactly which phrases match, please see the PDF report.",
          isMatch: false 
        }
      ],
      text2: [
        { 
          text: `This document contains approximately ${similarity}% similar content with the other document. `, 
          isMatch: true, 
          percentage: similarity 
        },
        { 
          text: "The system has detected matching content between these documents. For the most detailed view of exactly which phrases match, please see the PDF report.",
          isMatch: false 
        }
      ]
    });
  };

  // Prepare data from backend format
  const prepareReportData = () => {
    if (!reportData) return null;
    
    // If the data is already in the right format, return it
    if (reportData.assignment) return reportData;
    
    // If it's a results array from the backend, transform it
    if (Array.isArray(reportData) || (reportData.results && Array.isArray(reportData.results))) {
      const results = Array.isArray(reportData) ? reportData : reportData.results;
      
      return {
        assignment: results.map((result, index) => ({
          id: index + 1,
          file1: result.assignment1_title || "Document 1",
          file2: result.assignment2_title || "Document 2",
          similarity: result.similarity_score || 0,
          report_url: result.report_url || null,
          assignment1_id: result.assignment1_id,
          assignment2_id: result.assignment2_id
        }))
      };
    }
    
    // If it's another format, try to adapt
    return {
      assignment: [{
        id: 1,
        file1: "Document 1",
        file2: "Document 2", 
        similarity: reportData.similarity_score || 0
      }]
    };
  };
  
  // Get formatted data
  const formattedData = prepareReportData();

  // Highlight matches with Turnitin-like colors
  const highlightMatches = (segments, expandText = false) => {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return (
        <div className="text-center p-3">
          <FaInfoCircle className="me-2" />
          <span className="text-muted">No text segments available</span>
        </div>
      );
    }
    
    return segments.map((segment, i) => {
      // Handle different data formats
      const isMatch = segment.isMatch !== undefined ? segment.isMatch : segment.matched;
      const percentage = segment.percentage || (isMatch ? 75 : 0);
      const text = segment.text || segment;
      
      // Limit text display for non-expanded view
      const displayText = expandText || text.length < 100 ? text : text.substring(0, 100) + '...';
      
      if (!isMatch) {
        return <span key={i}>{displayText}</span>;
      }

      // Select color based on similarity percentage
      let bgColor;
      if (percentage >= 75) bgColor = "#ff9999";
      else if (percentage >= 50) bgColor = "#ffcc99";
      else if (percentage >= 25) bgColor = "#ffff99";
      else bgColor = "#e6ffe6";

      return (
        <span
          key={i}
          style={{
            backgroundColor: bgColor,
            padding: "1px 2px",
            margin: "2px 0",
            borderRadius: "3px",
            display: "inline-block",
            position: "relative"
          }}
          title={`${percentage}% similar`}
        >
          {displayText}
          <span style={{
            position: "absolute",
            top: "-10px",
            right: "0",
            fontSize: "0.6rem",
            backgroundColor: bgColor,
            padding: "0 3px",
            borderRadius: "3px",
            border: "1px solid #ddd"
          }}>
            {percentage}%
          </span>
        </span>
      );
    });
  };

  // Generate statistics
  const generateStats = () => {
    if (!formattedData || !formattedData.assignment || formattedData.assignment.length === 0) {
      return {
        average: 0,
        high: 0,
        medium: 0,
        low: 0,
        minimal: 0,
        comparisons: 0
      };
    }
    
    const assignments = formattedData.assignment;
    return {
      average: assignments.reduce((acc, item) => acc + item.similarity, 0) / assignments.length,
      high: assignments.filter(item => item.similarity >= 75).length,
      medium: assignments.filter(item => item.similarity >= 50 && item.similarity < 75).length,
      low: assignments.filter(item => item.similarity >= 25 && item.similarity < 50).length,
      minimal: assignments.filter(item => item.similarity < 25 && item.similarity > 0).length,
      comparisons: assignments.length
    };
  };
  
  const stats = generateStats();

  // Generate PDF report
  const generatePDFReport = () => {
    if (!reportRef.current) return;
    
    setLoading(true);
    
    html2canvas(reportRef.current, {
      scale: 2,
      logging: true,
      useCORS: true
    }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('assignment-similarity-report.pdf');
      setLoading(false);
    }).catch(err => {
      console.error("Error generating PDF:", err);
      setLoading(false);
      setError("Failed to generate PDF");
    });
  };

  // View original report from backend
  const viewOriginalReport = (result) => {
    // Try to find a report URL
    let reportUrl = null;
    
    // Check different possible locations for report URL
    if (result && result.report_url) {
      reportUrl = result.report_url;
    } else if (reportData && reportData.report_url) {
      reportUrl = reportData.report_url;
    } else if (formattedData && formattedData.assignment && formattedData.assignment.length > 0) {
      reportUrl = formattedData.assignment[0].report_url;
    }
    
    if (reportUrl) {
      window.open(`http://127.0.0.1:8000${reportUrl}`, '_blank');
    } else {
      alert("Original report URL not available");
    }
  };

  // Toggle text expansion
  const toggleExpandText = () => {
    setExpandedText(!expandedText);
  };

  if (loading && !reportData) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-3">Loading report data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-4">
        <FaExclamationTriangle className="me-2" />
        {error}
      </div>
    );
  }

  if (!formattedData || !formattedData.assignment) {
    return (
      <div className="alert alert-warning m-4">
        <FaExclamationTriangle className="me-2" />
        No report data available. Please select a report to view.
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Assignment Similarity Report</h2>
        <div>
          <button 
            className="btn btn-outline-primary me-2"
            onClick={toggleExpandText}
          >
            {expandedText ? "Show Less Text" : "Show More Text"}
          </button>
          <button 
            className="btn btn-danger"
            onClick={generatePDFReport}
            disabled={loading}
          >
            <FaFilePdf className="me-2" />
            Export as PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-4 shadow-sm" style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div className="text-center mb-4">
          <h3>Assignment Similarity Detection Report</h3>
          <p className="text-muted">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        {/* Statistics Section */}
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">Similarity Overview</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <div className="d-flex align-items-center mb-2">
                  <div className="me-3">
                    <div 
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{ 
                        width: "80px", 
                        height: "80px",
                        backgroundColor: stats.average >= 75 ? '#dc3545' : 
                                         stats.average >= 50 ? '#ffc107' : 
                                         stats.average >= 25 ? '#ffff99' : 
                                         '#28a745',
                        color: (stats.average >= 75 || stats.average < 25) ? '#fff' : '#000'
                      }}
                    >
                      <span className="fw-bold fs-5">
                        {Math.round(stats.average)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h6 className="mb-1">Average Similarity</h6>
                    <div className="progress" style={{ height: "10px" }}>
                      <div 
                        className="progress-bar"
                        style={{ 
                          width: `${Math.round(stats.average)}%`,
                          backgroundColor: stats.average >= 75 ? '#dc3545' : 
                                           stats.average >= 50 ? '#ffc107' : 
                                           stats.average >= 25 ? '#ffff99' : 
                                           '#28a745'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="row text-center">
                  <div className="col-3">
                    <div className="p-2 rounded mb-1" style={{ backgroundColor: '#dc3545' }}>
                      <span className="text-white">{stats.high}</span>
                    </div>
                    <small>High (75%+)</small>
                  </div>
                  <div className="col-3">
                    <div className="p-2 rounded mb-1" style={{ backgroundColor: '#ffc107' }}>
                      <span className="text-dark">{stats.medium}</span>
                    </div>
                    <small>Medium (50-74%)</small>
                  </div>
                  <div className="col-3">
                    <div className="p-2 rounded mb-1" style={{ backgroundColor: '#ffff99' }}>
                      <span className="text-dark">{stats.low}</span>
                    </div>
                    <small>Low (25-49%)</small>
                  </div>
                  <div className="col-3">
                    <div className="p-2 rounded mb-1" style={{ backgroundColor: '#28a745' }}>
                      <span className="text-white">{stats.minimal}</span>
                    </div>
                    <small>Minimal (0-24%)</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center mt-3">
              <p><strong>Total Comparisons:</strong> {stats.comparisons}</p>
            </div>
          </div>
        </div>

        {/* Assignment Comparison Results */}
        <div className="assignment-results">
          <h4 className="mb-3">
            <FaInfoCircle className="me-2" />
            Assignment Comparison Details
          </h4>
          {formattedData.assignment.map((item) => (
            <div key={item.id} className="card mb-4">
              <div className="card-header" style={{ 
                backgroundColor: item.similarity >= 75 ? '#dc3545' : 
                                 item.similarity >= 50 ? '#ffc107' : 
                                 item.similarity >= 25 ? '#ffff99' : 
                                 '#f8f9fa',
                color: (item.similarity >= 75 || (item.similarity < 25 && item.similarity > 0)) ? 'white' : 'black'
              }}>
                <strong>Similarity: {item.similarity}%</strong> between {item.file1} and {item.file2}
              </div>
              <div className="card-body">
                {item.report_url && (
                  <div className="row mb-3">
                    <div className="col-12">
                      <div className="alert alert-info d-flex justify-content-between align-items-center">
                        <div>
                          <strong>For complete detailed highlighting, view the PDF report</strong>
                        </div>
                        <button 
                          className="btn btn-primary"
                          onClick={() => viewOriginalReport(item)}
                        >
                          <FaEye className="me-2" />
                          See PDF Report
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Display matching text segments */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="card h-100">
                      <div className="card-header">
                        <h6 className="mb-0">{item.file1}</h6>
                      </div>
                      <div className="card-body bg-light rounded" style={{ minHeight: "200px", overflow: "auto", maxHeight: "400px" }}>
                        <div className="similar-text-container">
                          {highlightMatches(similarTexts.text1, expandedText)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="card h-100">
                      <div className="card-header">
                        <h6 className="mb-0">{item.file2}</h6>
                      </div>
                      <div className="card-body bg-light rounded" style={{ minHeight: "200px", overflow: "auto", maxHeight: "400px" }}>
                        <div className="similar-text-container">
                          {highlightMatches(similarTexts.text2, expandedText)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Highlighting Legend */}
        <div className="card mb-4">
          <div className="card-header bg-light">
            <h5 className="mb-0">Highlighting Legend</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-3 mb-2">
                <div className="p-2 rounded" style={{ backgroundColor: "#ff9999" }}>
                  75-100% Similarity (High)
                </div>
              </div>
              <div className="col-md-3 mb-2">
                <div className="p-2 rounded" style={{ backgroundColor: "#ffcc99" }}>
                  50-74% Similarity (Medium)
                </div>
              </div>
              <div className="col-md-3 mb-2">
                <div className="p-2 rounded" style={{ backgroundColor: "#ffff99" }}>
                  25-49% Similarity (Low)
                </div>
              </div>
              <div className="col-md-3 mb-2">
                <div className="p-2 rounded" style={{ backgroundColor: "#e6ffe6" }}>
                  0-24% Similarity (Minimal)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-muted small">
            This report is generated automatically. Please review findings carefully.
          </p>
          <p className="text-muted small">
            Generated by Academic Integrity System
          </p>
        </div>
      </div>
    </div>
  );
}

export default AssignmentSimilarityReport;