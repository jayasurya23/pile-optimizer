import React from "react";

// Keeps one failing view from blanking the whole page (React only lets a class component do this).
//   scope="tab"  wraps one view and clears itself when `resetKey` changes (another tab or tracker).
//   scope="app"  wraps everything: full-page message with a reload button.
// Only errors thrown while rendering are caught here, not those in event handlers or timers.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const detail = String((error && error.message) || error);

    if (this.props.scope === "app") {
      return (
        <div role="alert" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
          padding:24,background:"#ffffff",color:"#333132",fontFamily:"'Jost',system-ui,sans-serif"}}>
          <div style={{maxWidth:520,background:"#fff0f0",border:"1px solid #e12a3f",borderRadius:8,padding:"18px 20px",lineHeight:1.6}}>
            <div style={{fontSize:16,fontWeight:700,color:"#e12a3f",marginBottom:6}}>Something went wrong</div>
            <div style={{fontSize:13}}>
              The page hit an unexpected error and cannot continue. Reload to start again.
              Anything you have not saved with Save Run will be lost.
            </div>
            <div style={{marginTop:10,fontSize:11,color:"#4d4d4f"}}>Details: {detail}</div>
            <button onClick={()=>window.location.reload()}
              style={{marginTop:12,padding:"6px 16px",fontSize:12,color:"#ffffff",background:"#ad1f2b",
                border:"none",borderRadius:4,cursor:"pointer"}}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return (
      <div role="alert" style={{background:"#fff0f0",border:"1px solid #e12a3f",borderRadius:8,padding:"14px 16px",lineHeight:1.6}}>
        <div style={{fontSize:13,fontWeight:700,color:"#e12a3f",marginBottom:4}}>This view could not be displayed</div>
        <div style={{fontSize:12}}>
          Something went wrong while drawing it. The rest of the app is still running: choose another tab
          or tracker, or reload the page if it keeps happening.
        </div>
        <div style={{marginTop:8,fontSize:10,color:"#4d4d4f"}}>Details: {detail}</div>
      </div>
    );
  }
}
