import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SeizureForm from '../components/forms/SeizureForm';
import ExpressionForm from '../components/forms/ExpressionForm';
import VitalSignsInput from '../components/forms/VitalSignsInput';
import IntakeInput from '../components/forms/IntakeInput';
import ExcretionInput from '../components/forms/ExcretionInput';
import SleepInput from '../components/forms/SleepInput';
import ActivityInput from '../components/forms/ActivityInput';
import CareInput from '../components/forms/CareInput';
import MedicationInput from '../components/forms/MedicationInput';
import OtherInput from '../components/forms/OtherInput';
import { useData } from '../contexts/DataContext';
import { useAdmin } from '../contexts/AdminContext';

interface TodayEventCounts {
  [key: string]: number;
}

const StructuredDailyLogPage: React.FC = () => {
  const navigate = useNavigate();
  const { users, addDailyLog } = useData();
  const { isAdminMode, isAuthenticated, autoSaveEnabled } = useAdmin();
  const [activeEventType, setActiveEventType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [todayEventCounts, setTodayEventCounts] = useState<TodayEventCounts>({});
  const [showAdminWarning, setShowAdminWarning] = useState(false);

  // 今日の日付を取得
  const today = new Date().toISOString().split('T')[0];

  // イベントタイプの定義
  const eventTypes = [
    { id: 'seizure', name: '発作', icon: '⚡', color: 'bg-red-500' },
    { id: 'expression', name: '表情・反応', icon: '😊', color: 'bg-blue-500' },
    { id: 'vital', name: 'バイタル', icon: '🌡️', color: 'bg-green-500' },
    { id: 'meal', name: '食事・水分', icon: '🍽️', color: 'bg-orange-500' },
    { id: 'excretion', name: '排泄', icon: '🚽', color: 'bg-purple-500' },
    { id: 'sleep', name: '睡眠', icon: '😴', color: 'bg-indigo-500' },
    { id: 'activity', name: '活動', icon: '🎯', color: 'bg-teal-500' },
    { id: 'care', name: 'ケア', icon: '🤲', color: 'bg-pink-500' },
    { id: 'medication', name: '服薬', icon: '💊', color: 'bg-cyan-500' },
    { id: 'other', name: 'その他', icon: '📝', color: 'bg-gray-500' }
  ];

  // 今日の記録数を取得
  useEffect(() => {
    const counts: TodayEventCounts = {};
    eventTypes.forEach(type => {
      counts[type.id] = 0;
    });

    // 実際の記録がある場合は、ここでlocalStorageから取得して集計
    try {
      users.forEach(user => {
        const userRecords = JSON.parse(localStorage.getItem(`dailyLogs_${user.id}`) || '[]');
        const todayRecords = userRecords.filter((record: any) => 
          record.timestamp && record.timestamp.split('T')[0] === today
        );
        
        todayRecords.forEach((record: any) => {
          if (counts[record.event_type] !== undefined) {
            counts[record.event_type]++;
          }
        });
      });
    } catch (error) {
      console.error('今日の記録数の取得でエラー:', error);
    }

    setTodayEventCounts(counts);
  }, [users, today]);

  // 管理者権限の警告表示
  useEffect(() => {
    if (!autoSaveEnabled && !isAdminMode) {
      setShowAdminWarning(true);
      const timer = setTimeout(() => setShowAdminWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [autoSaveEnabled, isAdminMode]);

  // イベント保存処理
  const handleSaveEvent = async (eventData: any) => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      // DailyLog型に合わせてデータを構築
      const logData = {
        userId: selectedUserId,
        staff_id: 'current-staff',
        author: '記録者',
        authorId: 'current-staff',
        record_date: today,
        recorder_name: '記録者',
        weather: '記録なし',
        mood: [],
        meal_intake: {
          breakfast: '記録なし',
          lunch: '記録なし',
          snack: '記録なし',
          dinner: '記録なし'
        },
        hydration: 0,
        toileting: [],
        activity: {
          participation: ['記録なし'],
          mood: '記録なし',
          notes: ''
        },
        special_notes: [{
          category: activeEventType || 'general',
          details: JSON.stringify({
            event_type: activeEventType,
            timestamp: new Date().toISOString(),
            data: eventData,
            notes: eventData.notes || '',
            admin_created: isAdminMode && isAuthenticated
          })
        }]
      };

      await addDailyLog(logData);
      
      // localStorageにも個別イベントとして保存（既存のシステムとの互換性のため）
      const eventKey = `${activeEventType}_records_${today}`;
      const existingRecords = JSON.parse(localStorage.getItem(eventKey) || '[]');
      const newRecord = {
        id: Date.now().toString(),
        user_id: selectedUserId,
        event_type: activeEventType,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        data: eventData,
        notes: eventData.notes || '',
        admin_created: isAdminMode && isAuthenticated,
        auto_saved: autoSaveEnabled && !isAdminMode
      };
      existingRecords.push(newRecord);
      localStorage.setItem(eventKey, JSON.stringify(existingRecords));

      setActiveEventType(null);
      
      // 今日の記録数を更新
      setTodayEventCounts(prev => ({
        ...prev,
        [activeEventType!]: (prev[activeEventType!] || 0) + 1
      }));

      alert('✅ 記録を保存しました');

    } catch (error) {
      console.error('記録の保存でエラー:', error);
      alert('記録の保存中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 構造化日誌入力</h1>
          <p className="text-gray-600">利用者の日常記録を構造化して記録します</p>
        </div>

        {/* 管理モード・自動保存状態表示 */}
        {(isAdminMode || !autoSaveEnabled || showAdminWarning) && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border-l-4 border-blue-500">
            <div className="flex flex-wrap justify-between items-center text-sm">
              <div className="flex space-x-4">
                {isAdminMode && (
                  <div className={`flex items-center ${isAuthenticated ? 'text-green-700' : 'text-red-700'}`}>
                    <span className="font-semibold mr-2">🔒</span>
                    管理者モード: {isAuthenticated ? '認証済み' : '未認証'}
                  </div>
                )}
                <div className={`flex items-center ${autoSaveEnabled ? 'text-green-700' : 'text-orange-700'}`}>
                  <span className="font-semibold mr-2">💾</span>
                  自動保存: {autoSaveEnabled ? '有効' : '無効'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 管理者権限の警告 */}
        {showAdminWarning && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-orange-500">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-orange-700">
                  自動保存が無効です。記録は手動で保存する必要があります。
                  <button
                    className="ml-2 font-medium underline hover:no-underline"
                    onClick={() => navigate('/users')}
                  >
                    利用者管理で設定
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 利用者選択 */}
        {!selectedUserId && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📝 記録する利用者を選択</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">{user.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{user.name}</div>
                      <div className="text-sm text-gray-500">記録を開始</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 記録画面 */}
        {selectedUserId && (
          <div className="space-y-6">
            {!activeEventType ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedUserId('')}
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>←</span>
                    <span>利用者選択に戻る</span>
                  </button>
                </div>

                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    📝 {users.find(u => u.id === selectedUserId)?.name}さんの記録
                  </h2>
                  <div className="text-sm text-gray-600">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                      今日の記録: {Object.values(todayEventCounts).reduce((total, count) => total + count, 0)}件
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                    {Object.entries(todayEventCounts).map(([type, count]) => (
                      <span key={type} className="text-gray-500">
                        {eventTypes.find(t => t.id === type)?.name}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-700 mb-4">記録する項目を選択してください</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {eventTypes.map((eventType) => (
                    <button
                      key={eventType.id}
                      onClick={() => setActiveEventType(eventType.id)}
                      className={`relative p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 ${eventType.color} bg-opacity-10`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">{eventType.icon}</div>
                        <div className="font-medium text-gray-800">{eventType.name}</div>
                        {todayEventCounts[eventType.id] > 0 && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                            {todayEventCounts[eventType.id]}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => setActiveEventType(null)}
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>←</span>
                    <span>項目選択に戻る</span>
                  </button>
                  <h2 className="text-xl font-bold text-gray-800">
                    {eventTypes.find(t => t.id === activeEventType)?.name}の記録
                  </h2>
                </div>

                {/* フォームコンポーネント */}
                {activeEventType === 'seizure' && (
                  <SeizureForm onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'expression' && (
                  <ExpressionForm onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'vital' && (
                  <VitalSignsInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'meal' && (
                  <IntakeInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'excretion' && (
                  <ExcretionInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'sleep' && (
                  <SleepInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'activity' && (
                  <ActivityInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'care' && (
                  <CareInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'medication' && (
                  <MedicationInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'other' && (
                  <OtherInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuredDailyLogPage;
